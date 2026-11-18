package main

import (
	"errors"
	"fmt"
	"os"
	"path/filepath"
	"runtime"
	"syscall"
	"unsafe"
)

type guid struct {
	A    uint32
	B, C uint16
	D    [8]byte
}

func documents() (string, error) {
	runtime.LockOSThread()
	defer runtime.UnlockOSThread()
	ole := syscall.NewLazyDLL("ole32.dll")
	hr, _, _ := ole.NewProc("CoInitializeEx").Call(0, 2)
	if int32(hr) < 0 {
		return "", fmt.Errorf("COM initialization: 0x%x", hr)
	}
	defer ole.NewProc("CoUninitialize").Call()
	id := guid{0xfdd39ad0, 0x238f, 0x46af, [8]byte{0xad, 0xb4, 0x6c, 0x85, 0x48, 0x03, 0x69, 0xc7}}
	var p *uint16
	hr, _, _ = syscall.NewLazyDLL("shell32.dll").NewProc("SHGetKnownFolderPath").Call(uintptr(unsafe.Pointer(&id)), 0, 0, uintptr(unsafe.Pointer(&p)))
	if p != nil {
		defer ole.NewProc("CoTaskMemFree").Call(uintptr(unsafe.Pointer(p)))
	}
	if int32(hr) < 0 || p == nil {
		return "", errors.New("could not locate Documents; drag your TTS data folder onto INSTALL-STANDARD-CONTROLS.cmd")
	}
	var b []uint16
	for i := uintptr(0); i < 32768; i++ {
		c := *(*uint16)(unsafe.Add(unsafe.Pointer(p), i*2))
		if c == 0 {
			break
		}
		b = append(b, c)
	}
	return syscall.UTF16ToString(b), nil
}
func defaultRoot() (string, error) {
	docs, e := documents()
	if e != nil {
		return "", e
	}
	preferred := filepath.Join(docs, "My Games", "Tabletop Simulator")
	candidates := []string{preferred}
	for _, key := range []string{"OneDrive", "OneDriveConsumer", "OneDriveCommercial", "USERPROFILE"} {
		if p := os.Getenv(key); p != "" {
			candidates = append(candidates, filepath.Join(p, "Documents", "My Games", "Tabletop Simulator"))
		}
	}
	for _, c := range candidates {
		if i, e := os.Stat(c); e == nil && i.IsDir() {
			return c, nil
		}
	}
	return preferred, nil
}
func openWorkshop() error {
	verb, _ := syscall.UTF16PtrFromString("open")
	url, _ := syscall.UTF16PtrFromString(workshopURL)
	r, _, _ := syscall.NewLazyDLL("shell32.dll").NewProc("ShellExecuteW").Call(0, uintptr(unsafe.Pointer(verb)), uintptr(unsafe.Pointer(url)), 0, 0, 1)
	if r <= 32 {
		return fmt.Errorf("browser launch failed: %d", r)
	}
	return nil
}
