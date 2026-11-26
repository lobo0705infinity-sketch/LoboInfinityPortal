package main

import (
	"fmt"
	"path/filepath"
	"syscall"
	"unsafe"
)

// CSIDL_PERSONAL follows redirected Documents folders, including OneDrive.
func defaultRoot() (string, error) {
	proc := syscall.NewLazyDLL("shell32.dll").NewProc("SHGetFolderPathW")
	var buf [260]uint16
	code, _, _ := proc.Call(0, 5, 0, 0, uintptr(unsafe.Pointer(&buf[0])))
	if code != 0 {
		return "", fmt.Errorf("could not find Documents; drag your Tabletop Simulator data folder onto Install.cmd")
	}
	docs := syscall.UTF16ToString(buf[:])
	return filepath.Join(docs, "My Games", "Tabletop Simulator"), nil
}
