
type Post = {
  title: string,
  url: string,
  date: string,
  description: string
}

type Model = {
  posts: Post[],
  comments: string[]
}

const model: Model = {
  posts: [
    { title: "Bob's best day", url: "/bobs-best-day", date: "2024-04-18", description: "My day at the beach" },
    { title: "Bob's worst day", url: "/bobs-worst-day", date: "2024-04-20", description: "My day at the museum" },
    { title: "Bob's last day", url: "/bobs-last-day", date: "2024-04-21", description: "My day at the carnival" }
  ],
  comments: [],
}


Bun.serve({
  static: {
    "/": new Response(await Bun.file("./index.html").bytes(), {
      headers: {
        "Content-Type": "text/html"
      }
    }),
    "/static/quickweb.js": new Response(await Bun.file("./quickweb.js").bytes(), {
      headers: {
        "Content-Type": "application/javascript"
      }
    })
  },
  fetch(req, server) {
    const url = new URL(req.url);
    if (url.pathname === "/ws") {
      server.upgrade(req)
      return
    }

    return new Response("404!")
  },
  websocket: {
    open(ws) {
      console.log("Connected!")
    },
    message(ws, msg) {
      switch (msg) {
        case "PageLoaded":
          ws.send(JSON.stringify({ msg: "update", model: model }));
          break;
        default:
          console.error('Unknown message:', msg)
      }
    },
    close(ws, code, msg) {
      console.log("Disconnected!")
    },
    drain(ws) {
      console.log("Ready for data!")
    }
  }
})
