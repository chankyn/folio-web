package main

import (
	"archive/zip"
	"bytes"
	"encoding/xml"
	"errors"
	"io"
	"strings"
)

type ImportLine struct {
	Text      string `json:"text"`
	Bold      bool   `json:"bold,omitempty"`
	Color     bool   `json:"color,omitempty"`
	Highlight bool   `json:"highlight,omitempty"`
	Underline bool   `json:"underline,omitempty"`
	Mark      string `json:"mark,omitempty"`
}

func docxLines(b []byte) ([]ImportLine, error) {
	z, e := zip.NewReader(bytes.NewReader(b), int64(len(b)))
	if e != nil {
		return nil, e
	}
	var f *zip.File
	for _, x := range z.File {
		if x.Name == "word/document.xml" {
			f = x
			break
		}
	}
	if f == nil || f.UncompressedSize64 > 24<<20 {
		return nil, errors.New("DOCX sin documento válido")
	}
	r, e := f.Open()
	if e != nil {
		return nil, e
	}
	defer r.Close()
	d := xml.NewDecoder(io.LimitReader(r, 24<<20))
	var out []ImportLine
	var cur ImportLine
	var inP, inT, inRun bool
	var run ImportLine
	var ptext strings.Builder
	for {
		t, e := d.Token()
		if e == io.EOF {
			break
		}
		if e != nil {
			return nil, e
		}
		switch x := t.(type) {
		case xml.StartElement:
			switch x.Name.Local {
			case "p":
				inP = true
				cur = ImportLine{}
				ptext.Reset()
			case "r":
				inRun = true
				run = ImportLine{}
			case "t":
				inT = true
			case "tab":
				if inP {
					ptext.WriteByte(' ')
				}
			case "br":
				if inP {
					ptext.WriteByte(' ')
				}
			case "b", "color", "highlight", "shd", "u":
				if inP && inRun {
					val := ""
					for _, a := range x.Attr {
						if a.Name.Local == "val" || x.Name.Local == "shd" && a.Name.Local == "fill" {
							val = strings.ToLower(a.Value)
						}
					}
					switch x.Name.Local {
					case "b":
						run.Bold = val != "0" && val != "false" && val != "off"
					case "color":
						run.Color = val != "" && val != "auto" && val != "000000"
					case "highlight", "shd":
						run.Highlight = val != "" && val != "none" && val != "auto" && val != "ffffff" && val != "nil" && val != "clear"
					case "u":
						run.Underline = val != "none" && val != "0"
					}
				}
			}
		case xml.CharData:
			if inP && inT {
				ptext.Write([]byte(x))
				if strings.TrimSpace(string(x)) != "" {
					cur.Bold = cur.Bold || run.Bold
					cur.Color = cur.Color || run.Color
					cur.Highlight = cur.Highlight || run.Highlight
					cur.Underline = cur.Underline || run.Underline
				}
			}
		case xml.EndElement:
			switch x.Name.Local {
			case "t":
				inT = false
			case "r":
				inRun = false
			case "p":
				inP = false
				cur.Text = strings.TrimSpace(ptext.String())
				if cur.Text != "" {
					out = append(out, cur)
					if len(out) > 30000 {
						return nil, errors.New("Demasiados párrafos")
					}
				}
			}
		}
	}
	if len(out) == 0 {
		return nil, errors.New("No se encontró texto en el DOCX")
	}
	return out, nil
}
