package main

import (
	"archive/zip"
	"bufio"
	"bytes"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"errors"
	"flag"
	"fmt"
	"io"
	"os"
	"path/filepath"
	"strings"
	"time"
)

const collectionName = "Lobo Maps - MissionGeist R4 - Workshop Collection"
const workshopURL = "https://steamcommunity.com/sharedfiles/filedetails/?id=3719263238"

type object = map[string]any
type patch struct {
	Map            string `json:"map"`
	GUID           string `json:"guid"`
	Old            string `json:"old"`
	New            string `json:"new"`
	PreviousSHA256 string `json:"previous_sha256,omitempty"`
}
type receipt struct {
	Title   string `json:"save_name"`
	Version string `json:"version"`
	Source  string `json:"source"`
	Save    string `json:"collection_save"`
	Maps    int    `json:"maps"`
	Changed int    `json:"scripts_updated"`
	Play    string `json:"play_save,omitempty"`
}

func str(o object, k string) string { s, _ := o[k].(string); return s }
func arr(o object, k string) []any  { a, _ := o[k].([]any); return a }
func decode(b []byte) (object, error) {
	var d object
	dec := json.NewDecoder(bytes.NewReader(bytes.TrimPrefix(b, []byte{0xef, 0xbb, 0xbf})))
	dec.UseNumber()
	e := dec.Decode(&d)
	if e != nil {
		return nil, e
	}
	var extra any
	if dec.Decode(&extra) != io.EOF {
		return nil, errors.New("trailing JSON")
	}
	return d, nil
}
func encode(o any) ([]byte, error) {
	var b bytes.Buffer
	e := json.NewEncoder(&b)
	e.SetEscapeHTML(false)
	err := e.Encode(o)
	return b.Bytes(), err
}
func walk(o object, f func(object)) {
	f(o)
	for _, k := range []string{"ContainedObjects", "ChildObjects"} {
		for _, v := range arr(o, k) {
			if c, ok := v.(map[string]any); ok {
				walk(c, f)
			}
		}
	}
	if states, ok := o["States"].(map[string]any); ok {
		for _, v := range states {
			if c, ok := v.(map[string]any); ok {
				walk(c, f)
			}
		}
	}
}
func maps(d object) []object {
	var found []object
	var visit func(object)
	visit = func(o object) {
		if str(o, "Name") == "Bag" && strings.HasPrefix(str(o, "Nickname"), "SET_") && strings.Contains(str(o, "LuaScript"), "--") {
			found = append(found, o)
			return
		}
		for _, v := range arr(o, "ContainedObjects") {
			if c, ok := v.(map[string]any); ok {
				visit(c)
			}
		}
	}
	for _, v := range arr(d, "ObjectStates") {
		if o, ok := v.(map[string]any); ok {
			visit(o)
		}
	}
	return found
}
func supported(d object) bool {
	stage := false
	for _, v := range arr(d, "ObjectStates") {
		if o, ok := v.(map[string]any); ok && str(o, "GUID") == "2d647a" {
			stage = true
		}
	}
	return stage && len(maps(d)) >= 100
}
func payload(path string) (map[string][]byte, error) {
	z, e := zip.OpenReader(path)
	if e != nil {
		return nil, fmt.Errorf("extract the whole ZIP first: %w", e)
	}
	defer z.Close()
	files := map[string][]byte{}
	for _, f := range z.File {
		if f.FileInfo().IsDir() {
			continue
		}
		if f.UncompressedSize64 > 250000000 {
			return nil, errors.New("oversized payload")
		}
		r, e := f.Open()
		if e != nil {
			return nil, e
		}
		b, e := io.ReadAll(r)
		r.Close()
		if e != nil {
			return nil, e
		}
		if _, ok := files[f.Name]; ok {
			return nil, errors.New("duplicate payload entry")
		}
		files[f.Name] = b
	}
	var m struct {
		Files []struct {
			Name string `json:"name"`
			SHA  string `json:"sha256"`
		} `json:"files"`
	}
	if e = json.Unmarshal(files["installer-manifest.json"], &m); e != nil {
		return nil, e
	}
	checked := map[string]bool{}
	for _, f := range m.Files {
		b, ok := files[f.Name]
		if !ok {
			return nil, fmt.Errorf("missing %s", f.Name)
		}
		s := sha256.Sum256(b)
		if hex.EncodeToString(s[:]) != f.SHA {
			return nil, fmt.Errorf("checksum failed: %s", f.Name)
		}
		checked[f.Name] = true
	}
	for _, n := range []string{"Workshop-Save.json", "Workshop-Save.png", "control-patches.json", "release-extras.json"} {
		if !checked[n] {
			return nil, fmt.Errorf("unverified payload: %s", n)
		}
	}
	for name := range files {
		if name != "installer-manifest.json" && !checked[name] {
			return nil, fmt.Errorf("unverified file %s", name)
		}
	}
	return files, nil
}
func apply(d object, ps []patch) (int, error) {
	if !supported(d) {
		return 0, errors.New("not a complete Lobo collection")
	}
	byMap := map[string][]patch{}
	for _, p := range ps {
		byMap[p.Map] = append(byMap[p.Map], p)
	}
	seen := map[string]bool{}
	changed := 0
	for _, b := range maps(d) {
		want, ok := byMap[str(b, "GUID")]
		if !ok {
			return 0, fmt.Errorf("unrecognized map version: %s", str(b, "Nickname"))
		}
		if seen[str(b, "GUID")] {
			return 0, fmt.Errorf("duplicate catalogue bag: %s", str(b, "GUID"))
		}
		seen[str(b, "GUID")] = true
		nodes := map[string]object{}
		walk(b, func(o object) { nodes[str(o, "GUID")] = o })
		for _, p := range want {
			o, ok := nodes[p.GUID]
			if !ok {
				return 0, fmt.Errorf("changed object IDs in %s", str(b, "Nickname"))
			}
			s := str(o, "LuaScript")
			if s == p.New {
				continue
			}
			if s != p.Old && (p.PreviousSHA256 == "" || fmt.Sprintf("%x", sha256.Sum256([]byte(s))) != p.PreviousSHA256) {
				return 0, fmt.Errorf("newer or different controls in %s (%s)", str(b, "Nickname"), p.GUID)
			}
			o["LuaScript"] = p.New
			changed++
		}
	}
	for id := range byMap {
		if !seen[id] && id != "cb7100" {
			return 0, fmt.Errorf("source is missing supported setup %s", id)
		}
	}
	return changed, nil
}

// Carry the shipped artwork into a compatible older save while keeping the
// player's placement and other objects. Custom replacement textures stay local.
func updateCloudbreakMat(source, released object) {
	const oldTexture = "https://raw.githubusercontent.com/lobo0705infinity-sketch/LoboInfinityPortal/21dca17f7ef5a498a9d10d33e3fe790b1781c84d/cloudbreak-array-r4/assets/city-shafts.jpg"
	findMat := func(bag object) object {
		for _, value := range arr(bag, "ContainedObjects") {
			o, _ := value.(object)
			if str(o, "GUID") == "cb7101" {
				return o
			}
		}
		return nil
	}
	mat, current := findMat(source), findMat(released)
	oldMesh, _ := mat["CustomMesh"].(object)
	newMesh, _ := current["CustomMesh"].(object)
	if str(oldMesh, "DiffuseURL") != oldTexture || str(newMesh, "DiffuseURL") == "" {
		return
	}
	oldMesh["DiffuseURL"] = newMesh["DiffuseURL"]
	mat["Nickname"] = current["Nickname"]
	mat["Description"] = current["Description"]
}

// Only the release supplies the Workshop room. An explicitly selected save
// can supply compatible bag contents, never a play session or its shelf positions.
func selectSave(explicit string, files map[string][]byte, ps []patch) (object, string, int, error) {
	collection, err := decode(files["Workshop-Save.json"])
	if err != nil {
		return nil, "", 0, err
	}
	if str(collection, "SaveName") != collectionName || !supported(collection) {
		return nil, "", 0, errors.New("expected the R4 Workshop collection; extract the complete R4 installer")
	}
	if explicit == "" {
		n, err := apply(collection, ps)
		return collection, "Included Workshop collection", n, err
	}
	data, err := os.ReadFile(explicit)
	if err != nil {
		return nil, "", 0, err
	}
	source, err := decode(data)
	if err != nil {
		return nil, "", 0, err
	}
	n, err := apply(source, ps)
	if err != nil {
		return nil, "", 0, err
	}
	imported := map[string]object{}
	for _, bag := range maps(source) {
		imported[str(bag, "GUID")] = bag
	}
	for _, shelf := range maps(collection) {
		if bag := imported[str(shelf, "GUID")]; bag != nil {
			if str(shelf, "GUID") == "cb7100" {
				updateCloudbreakMat(bag, shelf)
			}
			shelf["ContainedObjects"] = bag["ContainedObjects"]
			shelf["LuaScript"] = bag["LuaScript"]
		}
	}
	return collection, explicit, n, nil
}

func writeNew(path string, b []byte) error {
	f, e := os.OpenFile(path, os.O_WRONLY|os.O_CREATE|os.O_EXCL, 0644)
	if e != nil {
		return e
	}
	_, e = f.Write(b)
	if e == nil {
		e = f.Sync()
	}
	ce := f.Close()
	if e == nil {
		e = ce
	}
	if e != nil {
		os.Remove(path)
	}
	return e
}
func writeSave(dir string, data, thumbnail []byte, created *[]string) (string, error) {
	for i := 1; i < 100000; i++ {
		base := filepath.Join(dir, fmt.Sprintf("TS_Save_%d", i))
		if _, err := os.Lstat(base + ".png"); err == nil {
			continue
		} else if !errors.Is(err, os.ErrNotExist) {
			return "", err
		}
		if err := writeNew(base+".json", data); errors.Is(err, os.ErrExist) {
			continue
		} else if err != nil {
			return "", err
		}
		*created = append(*created, base+".json")
		if err := writeNew(base+".png", thumbnail); err != nil {
			return "", err
		}
		*created = append(*created, base+".png")
		return base + ".json", nil
	}
	return "", errors.New("no unused save slot")
}

func install(root, explicit, path, variant string) (out receipt, err error) {
	files, e := payload(path)
	if e != nil {
		return out, e
	}
	var ps []patch
	if e = json.Unmarshal(files["control-patches.json"], &ps); e != nil {
		return out, e
	}
	d, source, n, e := selectSave(explicit, files, ps)
	if e != nil {
		return out, e
	}
	extras, e := readExtras(files)
	if e != nil {
		return out, e
	}
	selected := extras.Setups[variant]
	if variant != "" && selected.Name == "" {
		return out, fmt.Errorf("unknown start map %q", variant)
	}
	b, e := encode(d)
	if e != nil {
		return out, e
	}
	saveDir := filepath.Join(root, "Saves")
	if e = os.MkdirAll(saveDir, 0755); e != nil {
		return out, e
	}
	var created []string
	defer func() {
		if err != nil {
			for _, p := range created {
				os.Remove(p)
			}
		}
	}()
	if variant != "" {
		play := files[selected.PlayFile]
		thumbnail := files[selected.PlayThumbnail]
		if len(play) == 0 || len(thumbnail) == 0 {
			return out, fmt.Errorf("missing play table for %s", selected.Name)
		}
		out.Play, e = writeSave(saveDir, play, thumbnail, &created)
		if e != nil {
			return out, e
		}
	}
	out.Save, e = writeSave(saveDir, b, files["Workshop-Save.png"], &created)
	if e != nil {
		return out, e
	}
	objectDir := filepath.Join(saveDir, "Saved Objects", "Lobo MissionGeist")
	if e = os.MkdirAll(objectDir, 0755); e != nil {
		return out, e
	}
	for _, entry := range append(extras.Standalone, selected.Objects...) {
		if e = installObject(objectDir, entry, files, &created); e != nil {
			return out, e
		}
	}
	out.Title = str(d, "SaveName")
	out.Version = "MissionGeist Workshop Collection R4"
	out.Source = source
	out.Maps = len(maps(d))
	out.Changed = n
	logDir := filepath.Join(root, "Lobo Install Logs")
	if e = os.MkdirAll(logDir, 0755); e != nil {
		return out, e
	}
	log, e := encode(out)
	if e != nil {
		return out, e
	}
	lp := filepath.Join(logDir, "MissionGeist-Controls-"+time.Now().UTC().Format("20060102T150405.000000000")+".json")
	if e = writeNew(lp, log); e != nil {
		return out, e
	}
	created = append(created, lp)
	return out, nil
}
func main() {
	root := flag.String("tts-root", "", "TTS data folder")
	variant := flag.String("start-map", "", "Initial table for a map-specific installer")
	source := flag.String("source-save", "", "Explicit complete collection")
	path := flag.String("payload", "", "Payload ZIP")
	noBrowser := flag.Bool("no-browser", false, "Do not open Workshop")
	noPause := flag.Bool("no-pause", false, "Exit immediately")
	flag.Parse()
	code := 0
	defer func() {
		if !*noPause {
			fmt.Print("\nPress Enter to close...")
			bufio.NewReader(os.Stdin).ReadString('\n')
		}
		os.Exit(code)
	}()
	fmt.Println("LOBO MAPS - MISSIONGEIST CONTROLS")
	if *root == "" && flag.NArg() > 0 {
		*root = flag.Arg(0)
	}
	if *root == "" {
		r, e := defaultRoot()
		if e != nil {
			fmt.Println(e)
			code = 1
			return
		}
		*root = r
	}
	if strings.EqualFold(filepath.Base(*root), "Saves") {
		*root = filepath.Dir(*root)
	}
	if *path == "" {
		exe, e := os.Executable()
		if e != nil {
			fmt.Println(e)
			code = 1
			return
		}
		*path = filepath.Join(filepath.Dir(exe), "Files", "payload.zip")
	}
	if *variant == "" {
		if data, readErr := os.ReadFile(filepath.Join(filepath.Dir(*path), "start-map.txt")); readErr == nil {
			*variant = strings.TrimSpace(string(data))
		} else if !os.IsNotExist(readErr) {
			fmt.Println(readErr)
			code = 1
			return
		}
	}
	out, e := install(*root, *source, *path, *variant)
	if e != nil {
		fmt.Println("INSTALLATION FAILED:", e)
		fmt.Println("Existing saves were preserved.")
		code = 1
		return
	}
	fmt.Println("Installed:", out.Title)
	fmt.Println("Map setups:", out.Maps)
	fmt.Println("Source:", out.Source)
	if out.Play != "" {
		fmt.Println("Separate play table:", out.Play)
	}
	fmt.Println("In TTS: Games > Save & Load >", out.Title)
	fmt.Println("Use the catalogue to choose and copy a bag. On the play table, Map Controls > Mission gives the Mission Geist link.")
	fmt.Println("Publish: Upload > Workshop Upload > Update Workshop > 3719263238")
	fmt.Println("Steam publication is completed inside TTS. Existing saves remain intact.")
	if !*noBrowser {
		if e = openWorkshop(); e != nil {
			fmt.Println("Workshop:", workshopURL)
		}
	}
}
