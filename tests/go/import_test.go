package main

import (
	"archive/zip"
	"bytes"
	"os"
	"strings"
	"testing"
)

func TestMarkedPDF(t *testing.T) {
	b, e := os.ReadFile("examples/banco-marcas.pdf")
	if e != nil {
		t.Fatal(e)
	}
	lines, e := pdfLines(b)
	if e != nil {
		t.Fatal(e)
	}
	for _, l := range lines {
		t.Logf("%+v", l)
	}
	if len(lines) != 11 {
		t.Fatalf("got %d", len(lines))
	}
	if lines[2].Mark == "" || !lines[6].Color || lines[10].Color || !strings.Contains(lines[0].Text, "Qué") {
		t.Fatal("marks incorrectly assigned")
	}
}
func TestDOCX(t *testing.T) {
	var b bytes.Buffer
	z := zip.NewWriter(&b)
	w, _ := z.Create("word/document.xml")
	w.Write([]byte(`<w:document xmlns:w="test"><w:body><w:p><w:r><w:t>1. Enunciado</w:t></w:r></w:p><w:p><w:r><w:t>A) Uno</w:t></w:r></w:p><w:p><w:r><w:rPr><w:b/><w:color w:val="FF0000"/></w:rPr><w:t>B) Dos</w:t></w:r></w:p></w:body></w:document>`))
	z.Close()
	l, e := docxLines(b.Bytes())
	if e != nil || len(l) != 3 || !l[2].Bold || !l[2].Color || l[1].Bold {
		t.Fatalf("%+v %v", l, e)
	}
}
