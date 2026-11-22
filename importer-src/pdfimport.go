package main

// Small, deliberately conservative extractor for text/vector PDFs. It does not execute PDF code.
import (
	"bytes"
	"compress/zlib"
	"encoding/ascii85"
	"encoding/hex"
	"errors"
	"fmt"
	"io"
	"math"
	"regexp"
	"sort"
	"strconv"
	"strings"
	"unicode/utf16"
)

type pdfObj struct {
	head   string
	stream []byte
}

var objRE = regexp.MustCompile(`(?m)(?:^|[\r\n])\s*(\d+)\s+(\d+)\s+obj\b`)
var refRE = regexp.MustCompile(`(\d+)\s+\d+\s+R`)
var contentsRE = regexp.MustCompile(`(?s)/Contents\s*(\[[^\]]*\]|\d+\s+\d+\s+R)`)
var typePageRE = regexp.MustCompile(`/Type\s*/Page\b`)
var fontRefRE = regexp.MustCompile(`/([^\s/<>()\[\]]+)\s+(\d+)\s+\d+\s+R`)
var cmapRE = regexp.MustCompile(`<([0-9A-Fa-f]+)>\s*<([0-9A-Fa-f]+)>`)
var cmapRangeRE = regexp.MustCompile(`<([0-9A-Fa-f]+)>\s*<([0-9A-Fa-f]+)>\s*<([0-9A-Fa-f]+)>`)

func readPDFObjects(b []byte) (map[int]pdfObj, []int, error) {
	if !bytes.HasPrefix(b, []byte("%PDF-")) {
		return nil, nil, errors.New("No es un PDF válido")
	}
	m := objRE.FindAllSubmatchIndex(b, -1)
	if len(m) > 20000 {
		return nil, nil, errors.New("PDF demasiado complejo")
	}
	out := map[int]pdfObj{}
	order := []int{}
	budget := int64(96 << 20)
	for i, a := range m {
		id, _ := strconv.Atoi(string(b[a[2]:a[3]]))
		end := len(b)
		if i+1 < len(m) {
			end = m[i+1][0]
		}
		data := b[a[1]:end]
		if j := bytes.LastIndex(data, []byte("endobj")); j >= 0 {
			data = data[:j]
		}
		head := data
		var stream []byte
		if j := bytes.Index(data, []byte("stream")); j >= 0 && j+6 < len(data) && (data[j+6] == '\r' || data[j+6] == '\n') {
			head = data[:j]
			v := data[j+6:]
			if len(v) > 0 && v[0] == '\r' {
				v = v[1:]
			}
			if len(v) > 0 && v[0] == '\n' {
				v = v[1:]
			}
			if k := bytes.LastIndex(v, []byte("endstream")); k >= 0 {
				v = v[:k]
				// Decode common filters in their declared order. PDF image streams are not needed.
				h := string(head)
				if !strings.Contains(h, "/Subtype /Image") && !strings.Contains(h, "/Subtype/Image") {
					stream = decodeStream(v, h, min64(budget+1, 16<<20))
				}

				budget -= int64(len(stream))
				if budget < 0 {
					return nil, nil, errors.New("PDF descomprimido demasiado grande")
				}
			}
		}
		out[id] = pdfObj{string(head), stream}
		order = append(order, id)
	}
	// Expand standard compressed object streams (PDF 1.5+).
	for _, id := range append([]int(nil), order...) {
		o := out[id]
		if !strings.Contains(o.head, "/ObjStm") || len(o.stream) == 0 {
			continue
		}
		num := regexp.MustCompile(`/N\s+(\d+)`).FindStringSubmatch(o.head)
		first := regexp.MustCompile(`/First\s+(\d+)`).FindStringSubmatch(o.head)
		if len(num) < 2 || len(first) < 2 {
			continue
		}
		n, _ := strconv.Atoi(num[1])
		offset, _ := strconv.Atoi(first[1])
		if n < 0 || n > 10000 || offset < 0 || offset > len(o.stream) {
			continue
		}
		pairs := strings.Fields(string(o.stream[:offset]))
		if len(pairs) < n*2 {
			continue
		}
		for i := 0; i < n; i++ {
			oid, e1 := strconv.Atoi(pairs[i*2])
			start, e2 := strconv.Atoi(pairs[i*2+1])
			end := len(o.stream) - offset
			if i+1 < n {
				end, _ = strconv.Atoi(pairs[(i+1)*2+1])
			}
			if e1 != nil || e2 != nil || start < 0 || end < start || end > len(o.stream)-offset {
				continue
			}
			if _, exists := out[oid]; !exists {
				out[oid] = pdfObj{head: string(o.stream[offset+start : offset+end])}
				order = append(order, oid)
			}
		}
	}

	if len(out) == 0 {
		return nil, nil, errors.New("Estructura PDF no compatible")
	}
	return out, order, nil
}
func decodeStream(v []byte, h string, limit int64) []byte {
	if !strings.Contains(h, "/Filter") {
		return v
	}
	patterns := regexp.MustCompile(`/Filter\s*(\[[^\]]*\]|/[^\s<>/]+)`).FindStringSubmatch(h)
	if len(patterns) == 0 {
		return nil
	}
	filters := regexp.MustCompile(`/([A-Za-z0-9]+)`).FindAllStringSubmatch(patterns[1], -1)
	for _, f := range filters {
		switch f[1] {
		case "ASCII85Decode", "A85":
			v = bytes.TrimSpace(v)
			v = bytes.TrimPrefix(v, []byte("<~"))
			v = bytes.TrimSuffix(v, []byte("~>"))
			r := ascii85.NewDecoder(bytes.NewReader(v))
			data, e := io.ReadAll(io.LimitReader(r, limit+1))
			if e != nil || int64(len(data)) > limit {
				return nil
			}
			v = data
		case "ASCIIHexDecode", "AHx":
			clean := make([]byte, 0, len(v))
			for _, c := range v {
				if c == '>' {
					break
				}
				if c > 32 {
					clean = append(clean, c)
				}
			}
			if len(clean)%2 != 0 {
				clean = append(clean, '0')
			}
			d, e := hex.DecodeString(string(clean))
			if e != nil {
				return nil
			}
			v = d
		case "FlateDecode", "Fl":
			r, e := zlib.NewReader(bytes.NewReader(v))
			if e != nil {
				return nil
			}
			data, e := io.ReadAll(io.LimitReader(r, limit+1))
			r.Close()
			if e != nil || int64(len(data)) > limit {
				return nil
			}
			v = data
		default:
			return nil
		}
	}
	return v
}
func min64(a, b int64) int64 {
	if a < b {
		return a
	}
	return b
}
func refs(s string) []int {
	var a []int
	for _, m := range refRE.FindAllStringSubmatch(s, -1) {
		n, _ := strconv.Atoi(m[1])
		a = append(a, n)
	}
	return a
}
func utfHex(s string) string {
	b, e := hex.DecodeString(s)
	if e != nil {
		return ""
	}
	if len(b)%2 != 0 {
		return string(b)
	}
	u := make([]uint16, len(b)/2)
	for i := range u {
		u[i] = uint16(b[i*2])<<8 | uint16(b[i*2+1])
	}
	return string(utf16.Decode(u))
}
func cmap(s string) map[string]string {
	m := map[string]string{}
	for _, block := range regexp.MustCompile(`(?s)beginbfchar(.*?)endbfchar`).FindAllStringSubmatch(s, -1) {
		for _, a := range cmapRE.FindAllStringSubmatch(block[1], -1) {
			m[strings.ToUpper(a[1])] = utfHex(a[2])
		}
	}
	for _, block := range regexp.MustCompile(`(?s)beginbfrange(.*?)endbfrange`).FindAllStringSubmatch(s, -1) {
		for _, a := range cmapRangeRE.FindAllStringSubmatch(block[1], -1) {
			lo, _ := strconv.ParseInt(a[1], 16, 32)
			hi, _ := strconv.ParseInt(a[2], 16, 32)
			dst, e := strconv.ParseInt(a[3], 16, 32)
			if e == nil && hi-lo <= 1024 {
				for i := lo; i <= hi; i++ {
					m[fmt.Sprintf("%0*X", len(a[1]), i)] = string(rune(dst + i - lo))
				}
			}
		}
	}
	return m
}

type pfont struct {
	bold      bool
	mapping   map[string]string
	widths    map[int]float64 // font units (1/1000 em), keyed by PDF character code or CID
	firstChar int
	cid       bool // Type0 / Identity-H fonts encode glyphs as two-byte CID values
}

// Parse a CID font's /W array, including both ISO 32000 permitted forms:
// [firstCID [w1 w2 ...]] and [firstCID lastCID width].
// This is critical for Microsoft Print to PDF, which often emits each
// individual glyph in a TJ array without storing literal word spaces.
func parseCIDWidths(data string) map[int]float64 {
	t := tokens([]byte(data))
	widths := make(map[int]float64)
	for i := 0; i < len(t); {
		if t[i].kind != "num" {
			i++
			continue
		}
		start, err := strconv.Atoi(t[i].v)
		i++
		if err != nil || start < 0 || start > 65535 || i >= len(t) {
			continue
		}
		if t[i].kind == "[" {
			i++
			cid := start
			for i < len(t) && t[i].kind != "]" {
				if t[i].kind == "num" && cid <= 65535 {
					if w, err := strconv.ParseFloat(t[i].v, 64); err == nil && w >= 0 && w <= 3000 {
						widths[cid] = w
					}
					cid++
				}
				i++
			}
			if i < len(t) {
				i++
			}
			continue
		}
		if i+1 >= len(t) || t[i].kind != "num" || t[i+1].kind != "num" {
			continue
		}
		end, e1 := strconv.Atoi(t[i].v)
		w, e2 := strconv.ParseFloat(t[i+1].v, 64)
		i += 2
		if e1 != nil || e2 != nil || end < start || end > 65535 || end-start > 10000 || w < 0 || w > 3000 {
			continue
		}
		for cid := start; cid <= end; cid++ {
			widths[cid] = w
		}
	}
	return widths
}

func fontInfo(obj map[int]pdfObj, id int) pfont {
	h := obj[id].head
	f := pfont{bold: regexp.MustCompile(`(?i)(bold|black|heavy|demi|semibold)`).MatchString(h)}
	f.cid = strings.Contains(h, "/DescendantFonts") && strings.Contains(h, "/Type0")
	if f.cid {
		if a := regexp.MustCompile(`/W\s+(\d+)\s+\d+\s+R`).FindStringSubmatch(h); len(a) > 1 {
			wid, _ := strconv.Atoi(a[1])
			f.widths = parseCIDWidths(obj[wid].head)
		} else if a := regexp.MustCompile(`(?s)/W\s*(\[[^>]*?\])\s*(?:/|>>|$)`).FindStringSubmatch(h); len(a) > 1 {
			f.widths = parseCIDWidths(a[1])
		}
	}
	if a := regexp.MustCompile(`/FirstChar\s+(\d+)`).FindStringSubmatch(h); len(a) > 1 {
		f.firstChar, _ = strconv.Atoi(a[1])
	}
	widthData := ""
	if a := regexp.MustCompile(`(?s)/Widths\s*\[([^\]]*)\]`).FindStringSubmatch(h); len(a) > 1 {
		widthData = a[1]
	} else if a := regexp.MustCompile(`/Widths\s+(\d+)\s+\d+\s+R`).FindStringSubmatch(h); len(a) > 1 {
		n, _ := strconv.Atoi(a[1])
		widthData = strings.TrimSpace(strings.TrimSuffix(strings.TrimPrefix(strings.TrimSpace(obj[n].head), "["), "]"))
	}
	if widthData != "" && !f.cid {
		f.widths = make(map[int]float64)
		for i, v := range strings.Fields(widthData) {
			if i > 1024 {
				break
			}
			if width, err := strconv.ParseFloat(v, 64); err == nil && width >= 0 && width <= 3000 {
				f.widths[f.firstChar+i] = width
			}
		}
	}
	if a := regexp.MustCompile(`/ToUnicode\s+(\d+)\s+\d+\s+R`).FindStringSubmatch(h); len(a) > 0 {
		n, _ := strconv.Atoi(a[1])
		f.mapping = cmap(string(obj[n].stream))
	}
	return f
}
func decodePDF(b []byte, f pfont) string {
	if len(f.mapping) > 0 {
		var s strings.Builder
		for i := 0; i < len(b); {
			found := false
			for _, k := range []int{4, 3, 2, 1} {
				if i+k <= len(b) {
					if v, ok := f.mapping[strings.ToUpper(hex.EncodeToString(b[i:i+k]))]; ok {
						s.WriteString(v)
						i += k
						found = true
						break
					}
				}
			}
			if !found {
				s.WriteRune(rune(b[i]))
				i++
			}
		}
		return s.String()
	}
	if bytes.HasPrefix(b, []byte{0xfe, 0xff}) {
		return utfHex(hex.EncodeToString(b[2:]))
	}
	win := []rune{'€', '�', '‚', 'ƒ', '„', '…', '†', '‡', 'ˆ', '‰', 'Š', '‹', 'Œ', '�', 'Ž', '�', '�', '‘', '’', '“', '”', '•', '–', '—', '˜', '™', 'š', '›', 'œ', '�', 'ž', 'Ÿ'}
	var s strings.Builder
	for _, c := range b {
		if c >= 128 && c <= 159 {
			s.WriteRune(win[c-128])
		} else {
			s.WriteRune(rune(c))
		}
	}
	return s.String()
}

type ptok struct {
	kind string
	v    string
	b    []byte
}

func tokens(data []byte) []ptok {
	out := []ptok{}
	space := func(c byte) bool { return c <= 32 }
	delim := func(c byte) bool { return space(c) || strings.ContainsRune("()<>[]{}/%", rune(c)) }
	for i := 0; i < len(data) && len(out) < 1000000; {
		c := data[i]
		if space(c) {
			i++
			continue
		}
		if c == '%' {
			for i < len(data) && data[i] != '\n' && data[i] != '\r' {
				i++
			}
			continue
		}
		if c == '(' {
			i++
			depth := 1
			var b []byte
			for i < len(data) && depth > 0 {
				c = data[i]
				i++
				if c == '\\' && i < len(data) {
					c = data[i]
					i++
					if c >= '0' && c <= '7' {
						v := int(c - '0')
						for j := 0; j < 2 && i < len(data) && data[i] >= '0' && data[i] <= '7'; j++ {
							v = v*8 + int(data[i]-'0')
							i++
						}
						b = append(b, byte(v))
						continue
					}
					switch c {
					case 'n':
						c = '\n'
					case 'r':
						c = '\r'
					case 't':
						c = '\t'
					case '\n':
						continue
					case '\r':
						if i < len(data) && data[i] == '\n' {
							i++
						}
						continue
					}
					b = append(b, c)
					continue
				}
				if c == '(' {
					depth++
				}
				if c == ')' {
					depth--
					if depth == 0 {
						break
					}
				}
				b = append(b, c)
			}
			out = append(out, ptok{kind: "str", b: b})
			continue
		}
		if c == '<' && i+1 < len(data) && data[i+1] != '<' {
			i++
			var h []byte
			for i < len(data) && data[i] != '>' {
				if !space(data[i]) {
					h = append(h, data[i])
				}
				i++
			}
			if i < len(data) {
				i++
			}
			if len(h)%2 == 1 {
				h = append(h, '0')
			}
			b, _ := hex.DecodeString(string(h))
			out = append(out, ptok{kind: "str", b: b})
			continue
		}
		if c == '[' || c == ']' {
			out = append(out, ptok{kind: string(c), v: string(c)})
			i++
			continue
		}
		j := i
		if c == '/' {
			i++
		}
		for i < len(data) && !delim(data[i]) {
			i++
		}
		if i == j {
			i++
			continue
		}
		v := string(data[j:i])
		k := "op"
		if c == '/' {
			k = "name"
		} else if _, e := strconv.ParseFloat(v, 64); e == nil {
			k = "num"
		}
		out = append(out, ptok{k, v, nil})
	}
	return out
}

type matrix [6]float64

func identity() matrix { return matrix{1, 0, 0, 1, 0, 0} }
func (a matrix) at(x, y float64) (float64, float64) {
	return a[0]*x + a[2]*y + a[4], a[1]*x + a[3]*y + a[5]
}
func multiply(a, b matrix) matrix {
	x, y := a.at(b[4], b[5])
	return matrix{a[0]*b[0] + a[2]*b[1], a[1]*b[0] + a[3]*b[1], a[0]*b[2] + a[2]*b[3], a[1]*b[2] + a[3]*b[3], x, y}
}

type graphic struct {
	ctm           matrix
	color, stroke bool
}
type bounds struct {
	x1, y1, x2, y2 float64
	valid          bool
	curved         bool
}

func (b *bounds) add(x, y float64) {
	if !b.valid {
		*b = bounds{x, y, x, y, true, false}
		return
	}
	b.x1 = math.Min(b.x1, x)
	b.x2 = math.Max(b.x2, x)
	b.y1 = math.Min(b.y1, y)
	b.y2 = math.Max(b.y2, y)
}

type fragment struct {
	ImportLine
	x, y, w, size float64
}

// PDFs frequently position *words* rather than storing literal spaces.
// Use the PDF font's /Widths when available and a conservative fallback for
// other fonts. A fixed 0.5em per glyph causes both missing and extra spaces.
func fallbackGlyphWidth(r rune) float64 {
	switch {
	case r == ' ' || r == '\t':
		return .28
	case strings.ContainsRune("ilIjtfr.,:;!|()[]'`", r):
		return .28
	case strings.ContainsRune("MW@%", r):
		return .88
	case strings.ContainsRune("mw", r):
		return .78
	case r >= 'A' && r <= 'Z':
		return .65
	case r >= '0' && r <= '9':
		return .54
	default:
		return .51
	}
}
func glyphAdvance(f pfont, data []byte, decoded string, fontSize, charSpace, wordSpace, hscale float64) float64 {
	units := 0.0
	glyphCount := 0
	if f.cid && len(data)%2 == 0 {
		// Identity-H uses two bytes per glyph. Using estimated Latin character
		// widths here is inaccurate and destroys the inter-word spacing.
		runes := []rune(decoded)
		for i := 0; i+1 < len(data); i += 2 {
			code := int(data[i])<<8 | int(data[i+1])
			if w, ok := f.widths[code]; ok {
				units += w / 1000
			} else if glyphCount < len(runes) {
				units += fallbackGlyphWidth(runes[glyphCount])
			} else {
				units += 0.5
			}
			glyphCount++
		}
	} else if len(f.widths) > 0 && len(data) == len([]rune(decoded)) {
		for _, c := range data {
			if w, ok := f.widths[int(c)]; ok {
				units += w / 1000
			} else {
				units += fallbackGlyphWidth(rune(c))
			}
			glyphCount++
		}
	} else {
		for _, c := range decoded {
			units += fallbackGlyphWidth(c)
			glyphCount++
		}
	}
	return (units*fontSize + charSpace*float64(glyphCount) + wordSpace*float64(strings.Count(decoded, " "))) * hscale
}

func pageExtract(b []byte, fonts map[string]pfont) ([]fragment, []bounds) {
	ts := tokens(b)
	g := graphic{ctm: identity()}
	var stack []graphic
	var args []ptok
	var fragments []fragment
	var marks []bounds
	var path bounds
	tm, lm := identity(), identity()
	font := pfont{}
	size := 11.0
	leading := 0.0
	charSpace, wordSpace, hscale := 0.0, 0.0, 1.0
	inText := false
	arr := false
	var array []ptok
	fnum := func(t ptok) float64 { x, _ := strconv.ParseFloat(t.v, 64); return x }
	n := func(i int) float64 {
		if i >= 0 && i < len(args) {
			return fnum(args[i])
		}
		return 0
	}
	move := func(x, y float64) { lm = multiply(lm, matrix{1, 0, 0, 1, x, y}); tm = lm }
	show := func(data []byte) {
		if !inText || len(data) == 0 {
			return
		}
		t := decodePDF(data, font)
		if t == "" {
			return
		}
		x, y := g.ctm.at(tm[4], tm[5])
		scale := math.Hypot(g.ctm[0]*tm[0]+g.ctm[2]*tm[1], g.ctm[1]*tm[0]+g.ctm[3]*tm[1])
		sz := math.Max(3, math.Abs(size)*scale)
		advance := glyphAdvance(font, data, t, size, charSpace, wordSpace, hscale)
		w := math.Abs(advance * scale)
		fragments = append(fragments, fragment{ImportLine: ImportLine{Text: t, Bold: font.bold, Color: g.color}, x: x, y: y, w: w, size: sz})
		tm = multiply(tm, matrix{1, 0, 0, 1, advance, 0})
	}
	point := func(x, y float64) { x, y = g.ctm.at(x, y); path.add(x, y) }
	paint := func(col bool) {
		if col && path.valid && path.x2-path.x1 >= 3 && path.y2-path.y1 >= 2 && path.y2-path.y1 < 45 && path.x2-path.x1 < 600 {
			if len(marks) < 5000 {
				marks = append(marks, path)
			}
		}
		path = bounds{}
	}
	for _, t := range ts {
		if t.kind == "[" {
			arr = true
			array = nil
			continue
		}
		if t.kind == "]" {
			arr = false
			continue
		}
		if arr {
			array = append(array, t)
			continue
		}
		if t.kind != "op" {
			args = append(args, t)
			if len(args) > 1000 {
				args = nil
			}
			continue
		}
		switch t.v {
		case "q":
			if len(stack) < 100 {
				stack = append(stack, g)
			}
		case "Q":
			if len(stack) > 0 {
				g = stack[len(stack)-1]
				stack = stack[:len(stack)-1]
			}
		case "cm":
			if len(args) >= 6 {
				g.ctm = multiply(g.ctm, matrix{n(0), n(1), n(2), n(3), n(4), n(5)})
			}
		case "rg", "RG":
			c := math.Max(n(0), math.Max(n(1), n(2)))-math.Min(n(0), math.Min(n(1), n(2))) > .16 && math.Max(n(0), math.Max(n(1), n(2))) > .25
			if t.v == "rg" {
				g.color = c
			} else {
				g.stroke = c
			}
		case "g":
			g.color = false
		case "G":
			g.stroke = false
		case "k", "K":
			c := math.Max(n(0), math.Max(n(1), n(2)))-math.Min(n(0), math.Min(n(1), n(2))) > .16
			if t.v == "k" {
				g.color = c
			} else {
				g.stroke = c
			}
		case "sc", "SC", "scn", "SCN":
			if len(args) >= 3 {
				c := math.Max(n(0), math.Max(n(1), n(2)))-math.Min(n(0), math.Min(n(1), n(2))) > .16
				if t.v == "sc" || t.v == "scn" {
					g.color = c
				} else {
					g.stroke = c
				}
			}
		case "BT":
			inText = true
			tm = identity()
			lm = identity()
		case "ET":
			inText = false
		case "Tf":
			if len(args) >= 2 {
				font = fonts[strings.TrimPrefix(args[0].v, "/")]
				size = n(1)
			}
		case "Tm":
			if len(args) >= 6 {
				tm = matrix{n(0), n(1), n(2), n(3), n(4), n(5)}
				lm = tm
			}
		case "Td":
			move(n(0), n(1))
		case "TD":
			leading = -n(1)
			move(n(0), n(1))
		case "TL":
			leading = n(0)
		case "Tc":
			charSpace = n(0)
		case "Tw":
			wordSpace = n(0)
		case "Tz":
			if n(0) > 0 && n(0) < 1000 {
				hscale = n(0) / 100
			}
		case "T*":
			move(0, -leading)
		case "Tj", "'", "\"":
			if len(args) > 0 {
				if t.v != "Tj" {
					move(0, -leading)
				}
				show(args[len(args)-1].b)
			}
		case "TJ":
			// An adjustment is in thousandths of one em; it is not itself a
			// literal space. Keep word fragments at their geometric positions.
			for _, a := range array {
				if a.kind == "str" {
					show(a.b)
				} else if a.kind == "num" {
					tm = multiply(tm, matrix{1, 0, 0, 1, -fnum(a) * size * hscale / 1000, 0})
				}
			}
			array = nil
		case "m", "l":
			point(n(0), n(1))
		case "c":
			point(n(0), n(1))
			point(n(2), n(3))
			point(n(4), n(5))
			path.curved = true
		case "v", "y":
			point(n(0), n(1))
			point(n(2), n(3))
			path.curved = true
		case "re":
			point(n(0), n(1))
			point(n(0)+n(2), n(1)+n(3))
		case "S", "s":
			paint(g.stroke)
		case "f", "F", "f*":
			paint(g.color)
		case "B", "B*", "b", "b*":
			paint(g.stroke || g.color)
		case "n":
			path = bounds{}
		}
		args = nil
	}
	return fragments, marks
}
func groupPDF(fs []fragment, marks []bounds) []ImportLine {
	sort.SliceStable(fs, func(i, j int) bool { return fs[i].y > fs[j].y })
	var groups [][]fragment
	for _, f := range fs {
		if strings.TrimSpace(f.Text) == "" {
			continue
		}
		if len(groups) == 0 || math.Abs(groups[len(groups)-1][0].y-f.y) > math.Max(2, f.size*.34) {
			groups = append(groups, []fragment{f})
		} else {
			groups[len(groups)-1] = append(groups[len(groups)-1], f)
		}
	}
	var out []ImportLine
	for _, row := range groups {
		sort.SliceStable(row, func(i, j int) bool { return row[i].x < row[j].x })
		l := ImportLine{}
		var s strings.Builder
		last := 0.
		for i, f := range row {
			if i > 0 && f.x-last > math.Max(0.9, f.size*.10) && !strings.HasSuffix(s.String(), " ") && !strings.HasPrefix(f.Text, " ") {
				s.WriteByte(' ')
			}
			s.WriteString(f.Text)
			last = f.x + f.w
			l.Bold = l.Bold || f.Bold
			l.Color = l.Color || f.Color
		}
		l.Text = strings.TrimSpace(s.String())
		if l.Text == "" {
			continue
		}
		f := row[0]
		for _, m := range marks {
			if f.y+f.size*.7 >= m.y1 && f.y-f.size*.3 <= m.y2 && m.x2 >= f.x-f.size*3 && m.x1 <= last+f.size && (m.x2-m.x1 > 2) {
				if m.curved {
					l.Mark = "Círculo o trazo de color junto a la opción"
				} else {
					l.Highlight = true
				}
			}
		}
		out = append(out, l)
	}
	return out
}
func pdfLines(b []byte) ([]ImportLine, error) {
	objs, order, e := readPDFObjects(b)
	if e != nil {
		return nil, e
	}
	var out []ImportLine
	globalFonts := map[string]pfont{}
	for _, id := range order {
		for _, a := range fontRefRE.FindAllStringSubmatch(objs[id].head, -1) {
			n, _ := strconv.Atoi(a[2])
			if strings.Contains(objs[n].head, "/BaseFont") {
				globalFonts[a[1]] = fontInfo(objs, n)
			}
		}
	}
	// Prefer the document's logical page order over object order.
	pageOrder := []int{}
	seen := map[int]bool{}
	kidsRE := regexp.MustCompile(`(?s)/Kids\s*\[([^\]]*)\]`)
	var walk func(int, int)
	walk = func(id, depth int) {
		if seen[id] || depth > 50 {
			return
		}
		seen[id] = true
		h := objs[id].head
		if typePageRE.MatchString(h) {
			pageOrder = append(pageOrder, id)
			return
		}
		if k := kidsRE.FindStringSubmatch(h); len(k) > 0 {
			for _, n := range refs(k[1]) {
				walk(n, depth+1)
			}
		}
	}
	for _, id := range order {
		if regexp.MustCompile(`/Type\s*/Catalog\b`).MatchString(objs[id].head) {
			if k := regexp.MustCompile(`/Pages\s+(\d+)\s+\d+\s+R`).FindStringSubmatch(objs[id].head); len(k) > 0 {
				n, _ := strconv.Atoi(k[1])
				walk(n, 0)
				break
			}
		}
	}
	if len(pageOrder) == 0 {
		pageOrder = order
	}
	pages := 0
	for _, id := range pageOrder {
		h := objs[id].head
		if !typePageRE.MatchString(h) {
			continue
		}
		pages++
		if pages > 300 {
			return nil, errors.New("Máximo 300 páginas por importación")
		}
		content := contentsRE.FindStringSubmatch(h)
		if len(content) == 0 {
			continue
		}
		fonts := map[string]pfont{}
		for k, v := range globalFonts {
			fonts[k] = v
		}
		for _, a := range fontRefRE.FindAllStringSubmatch(h, -1) {
			n, _ := strconv.Atoi(a[2])
			if strings.Contains(objs[n].head, "/BaseFont") {
				fonts[a[1]] = fontInfo(objs, n)
			}
		}
		var all []byte
		for _, n := range refs(content[1]) {
			all = append(all, objs[n].stream...)
			all = append(all, '\n')
		}
		fs, marks := pageExtract(all, fonts)
		if a := regexp.MustCompile(`(?s)/Annots\s*\[([^\]]*)\]`).FindStringSubmatch(h); len(a) > 0 {
			for _, n := range refs(a[1]) {
				an := objs[n].head
				if !regexp.MustCompile(`/Subtype\s*/(Circle|Square|Highlight|Ink)\b`).MatchString(an) {
					continue
				}
				m := regexp.MustCompile(`/Rect\s*\[\s*([-\d.]+)\s+([-\d.]+)\s+([-\d.]+)\s+([-\d.]+)\s*\]`).FindStringSubmatch(an)
				if len(m) == 5 {
					var v [4]float64
					for i := range v {
						v[i], _ = strconv.ParseFloat(m[i+1], 64)
					}
					marks = append(marks, bounds{v[0], v[1], v[2], v[3], true, strings.Contains(an, "/Circle") || strings.Contains(an, "/Ink")})
				}
			}
		}
		out = append(out, groupPDF(fs, marks)...)
	}
	if len(out) == 0 {
		return nil, errors.New("No se pudo extraer texto: PDF escaneado, comprimido con estructura no compatible o sin texto. Exporta a DOCX/TXT o aplica OCR externamente.")
	}
	return out, nil
}
