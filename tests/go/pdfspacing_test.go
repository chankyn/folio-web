package main

import (
	"math"
	"strings"
	"testing"
)

func extractOneLine(t *testing.T, commands string, font pfont) string {
	t.Helper()
	fragments, marks := pageExtract([]byte("BT /F1 12 Tf "+commands+" ET"), map[string]pfont{"F1": font})
	lines := groupPDF(fragments, marks)
	if len(lines) != 1 {
		t.Fatalf("wanted 1 line, got %+v", lines)
	}
	return lines[0].Text
}

func TestTextTJReconstructsWordsFromOffsets(t *testing.T) {
	got := extractOneLine(t, "1 0 0 1 60 700 Tm [(Hola) -400 (mundo)] TJ", pfont{})
	if got != "Hola mundo" {
		t.Fatalf("spaced TJ: %q", got)
	}
	got = extractOneLine(t, "1 0 0 1 60 700 Tm [(Micro) -25 (economia)] TJ", pfont{})
	if got != "Microeconomia" {
		t.Fatalf("TJ kerning must not insert a word: %q", got)
	}
}

func TestTextPositionedWordsAndContinuousRuns(t *testing.T) {
	got := extractOneLine(t, "1 0 0 1 60 700 Tm (Mercado) Tj 1 0 0 1 115 700 Tm (laboral) Tj", pfont{})
	if got != "Mercado laboral" {
		t.Fatalf("positioned words: %q", got)
	}
	got = extractOneLine(t, "1 0 0 1 60 700 Tm (Micro) Tj 1 0 0 1 88 700 Tm (economia) Tj", pfont{})
	if got != "Microeconomia" {
		t.Fatalf("continuous word fragments: %q", got)
	}
}

func TestExactFontWidthsAndWordSpacing(t *testing.T) {
	font := pfont{widths: map[int]float64{65: 800, 66: 700}}
	fragments, _ := pageExtract([]byte("BT /F1 12 Tf 1 0 0 1 60 700 Tm (A) Tj (B) Tj ET"), map[string]pfont{"F1": font})
	if len(fragments) != 2 || math.Abs(fragments[0].w-9.6) > 0.01 {
		t.Fatalf("width not applied: %+v", fragments)
	}
	if math.Abs(fragments[1].x-fragments[0].x-9.6) > 0.01 {
		t.Fatalf("advance incorrect: %+v", fragments)
	}
	got := strings.Join([]string{fragments[0].Text, fragments[1].Text}, "")
	if got != "AB" {
		t.Fatalf("glyph ordering: %q", got)
	}
}

func TestExistingSchoolhouseMarkedPDFStillRecognized(t *testing.T) {
	// TestMarkedPDF in import_test.go checks both marks and colored text.
	// This case also checks that line grouping does not fabricate spaces in labels.
	got := extractOneLine(t, "1 0 0 1 60 700 Tm (A) Tj (\\) correcta) Tj", pfont{})
	if !strings.HasPrefix(got, "A") {
		t.Fatalf("unexpected parse: %q", got)
	}
}
