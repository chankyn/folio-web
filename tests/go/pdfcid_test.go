package main

import (
	"math"
	"strings"
	"testing"
)

func TestCIDWidthArrayBothEncodings(t *testing.T) {
	widths := parseCIDWidths("[1 [500 520 480] 8 10 600 14 [300 700]]")
	expected := map[int]float64{1: 500, 2: 520, 3: 480, 8: 600, 9: 600, 10: 600, 14: 300, 15: 700}
	if len(widths) != len(expected) {
		t.Fatalf("incorrect number of CID widths: %v", widths)
	}
	for cid, want := range expected {
		if widths[cid] != want {
			t.Fatalf("CID %d: got %v want %v", cid, widths[cid], want)
		}
	}
}

func TestType0CIDFontReadsIndirectWidthTable(t *testing.T) {
	objects := map[int]pdfObj{
		1:  {head: "/Subtype /Type0 /BaseFont /CIDFont+F1 /DescendantFonts [ << /W 9 0 R >> ] /ToUnicode 10 0 R"},
		9:  {head: "[1 1 500 2 2 600]"},
		10: {stream: []byte("1 beginbfchar\n<0001> <0041>\nendbfchar\n1 beginbfchar\n<0002> <0042>\nendbfchar")},
	}
	font := fontInfo(objects, 1)
	if !font.cid || font.widths[1] != 500 || font.widths[2] != 600 || font.mapping["0001"] != "A" {
		t.Fatalf("CID font not loaded correctly: %+v", font)
	}
	advance := glyphAdvance(font, []byte{0, 1, 0, 2}, "AB", 12, 0, 0, 1)
	if math.Abs(advance-13.2) > 0.01 {
		t.Fatalf("wrong CID advance: %v", advance)
	}
}

func TestCIDTextReconstructsSpacesWithoutOCR(t *testing.T) {
	font := pfont{cid: true, mapping: map[string]string{"0001": "A", "0002": "B"}, widths: map[int]float64{1: 500, 2: 600}}
	tests := []struct{ name, input, want string }{
		{"word gap", "1 0 0 1 60 700 Tm [<0001> -180 <0002>] TJ", "A B"},
		{"kerning", "1 0 0 1 60 700 Tm [<0001> -20 <0002>] TJ", "AB"},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			fs, marks := pageExtract([]byte("BT /F1 12 Tf "+tt.input+" ET"), map[string]pfont{"F1": font})
			lines := groupPDF(fs, marks)
			if len(lines) != 1 || strings.TrimSpace(lines[0].Text) != tt.want {
				t.Fatalf("got %+v; want %q", lines, tt.want)
			}
		})
	}
}
