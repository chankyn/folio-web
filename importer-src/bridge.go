package main

import (
	"encoding/json"
	"fmt"
	"strings"
	"syscall/js"
)

func importFile(this js.Value, args []js.Value) any {
	if len(args) < 2 {
		return `{"error":"Archivo no proporcionado"}`
	}
	name := strings.ToLower(args[0].String())
	bytesJS := args[1]
	if bytesJS.Get("byteLength").Int() > 32<<20 {
		return `{"error":"Archivo superior a 32 MB"}`
	}
	data := make([]byte, bytesJS.Get("byteLength").Int())
	js.CopyBytesToGo(data, bytesJS)
	var lines []ImportLine
	var err error
	var warning string
	switch {
	case strings.HasSuffix(name, ".pdf"):
		lines, err = pdfLines(data)
		warning = "PDF: detección heurística de marcas vectoriales; comprueba cada respuesta. Las imágenes escaneadas requieren OCR externo."
	case strings.HasSuffix(name, ".docx"):
		lines, err = docxLines(data)
	default:
		err = fmt.Errorf("Formato no compatible: %s", name)
	}
	out := map[string]any{"lines": lines, "warning": warning}
	if err != nil {
		out = map[string]any{"error": err.Error()}
	}
	j, err2 := json.Marshal(out)
	if err2 != nil {
		return `{"error":"Error al serializar importación"}`
	}
	return string(j)
}

func main() {
	js.Global().Set("folioWasmImport", js.FuncOf(importFile))
	select {}
}
