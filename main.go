package main

import (
	"flag"
	"log"
	"net/http"
	"time"

	"github.com/wsxiaoys/terminal"
)

var addr = flag.String("addr", ":8080", "http service address")

func serveHome(w http.ResponseWriter, r *http.Request) {
	switch r.URL.Path {
	case "/":
		http.ServeFile(w, r, "static/index.html")
	case "/site.js":
		http.ServeFile(w, r, "static/js/site.js")
	case "/adapter.js":
		http.ServeFile(w, r, "static/js/adapter.js")
	case "/site.css":
		http.ServeFile(w, r, "static/css/site.css")
	default:
		http.Error(w, "Not found", http.StatusNotFound)
	}
}

func main() {
	flag.Parse()
	hub := newHub()
	go hub.run()
	http.HandleFunc("/", serveHome)
	http.HandleFunc("/ws", func(w http.ResponseWriter, r *http.Request) {
		serveWs(hub, w, r)
	})
	terminal.Stdout.Colorf("@r%s@{|} @gNow listening on@{|} @b%s@{|}\n", time.Now().Format(time.Stamp), *addr)
	err := http.ListenAndServe(*addr, logRequest(http.DefaultServeMux))
	// err := http.ListenAndServeTLS(*addr, "cert.pem", "key.pem", logRequest(http.DefaultServeMux))
	if err != nil {
		log.Fatal("ListenAndServe: ", err)
	}
}

func logRequest(handler http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		terminal.Stdout.Colorf("@r%s@{|} @y%s@{|} @b%s@{|} @g%s@{|}\n", time.Now().Format(time.Stamp), r.Method, r.RemoteAddr, r.URL)
		handler.ServeHTTP(w, r)
	})
}
