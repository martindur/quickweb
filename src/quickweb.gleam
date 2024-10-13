import gleam/bytes_builder
import gleam/erlang/process
import gleam/http/request.{type Request}
import gleam/http/response.{type Response}
import gleam/io
import gleam/json.{type Json}
import gleam/list
import gleam/option.{None, Some}
import gleam/otp/actor
import gleam/result
import gleam/string
import mist.{type Connection, type ResponseData}

pub type Post {
  Post(title: String, date: String, description: String)
}

pub type Model {
  Model(title: String, subtitle: String, posts: List(Post))
}

pub fn main() {
  let not_found =
    response.new(404)
    |> response.set_body(mist.Bytes(bytes_builder.new()))

  let selector = process.new_selector()
  let state =
    Model("Welcome to Dur's Blog", "Tech stuff and whatnot", [
      Post("Best post", "12-4-2019", "Some good stuff"),
      Post("Decent post", "14-8-2020", "Some decent stuff"),
      Post("Silly stuff", "08-2-2021", "Silly description"),
    ])

  let assert Ok(_) =
    fn(req: Request(Connection)) -> Response(ResponseData) {
      case request.path_segments(req) {
        [] -> serve_file("./src", ["index.html"])
        ["static", ..rest] -> serve_file("./priv/static", rest)
        ["ws"] ->
          mist.websocket(
            request: req,
            on_init: fn(_conn) { #(state, Some(selector)) },
            on_close: fn(_state) { io.println("goodbye!") },
            handler: handle_ws_message,
          )
        _ -> not_found
      }
    }
    |> mist.new
    |> mist.port(3000)
    |> mist.start_http

  process.sleep_forever()
}

// fn increment_counter(model: Model) -> Model {
//   Model(..model, counter: model.counter + 1)
// }

fn post_to_json(post: Post) -> Json {
  [
    #("title", json.string(post.title)),
    #("date", json.string(post.date)),
    #("description", json.string(post.description)),
  ]
  |> json.object
}

fn model_to_json(model: Model) -> Json {
  [
    #("title", json.string(model.title)),
    #("subtitle", json.string(model.subtitle)),
    #("posts", json.preprocessed_array(list.map(model.posts, post_to_json))),
  ]
  |> json.object
}

fn msg_to_json(msg_type: String, model: Model) -> String {
  [#("msg", json.string(msg_type)), #("model", model_to_json(model))]
  |> json.object
  |> json.to_string
}

fn serve_file(root: String, path: List(String)) -> Response(ResponseData) {
  // NOTE: Files are apparently from root level, but gleam imports are relative to src folder
  let full_path = string.join([root, ..path], "/")
  mist.send_file(full_path, offset: 0, limit: None)
  |> result.map(fn(file) {
    let content_type = case string.split(full_path, ".") |> list.reverse {
      ["html", ..] -> "text/html"
      ["css", ..] -> "text/css"
      ["js", ..] -> "application/javascript"
      _ -> "text/plain"
    }

    response.new(200)
    |> response.prepend_header("content-type", content_type)
    |> response.set_body(file)
  })
  |> result.lazy_unwrap(fn() {
    response.new(404)
    |> response.set_body(mist.Bytes(bytes_builder.new()))
  })
}

pub type MyMessage {
  Broadcast(String)
}

fn handle_ws_message(state: Model, conn, message) {
  case message {
    mist.Text("PageLoaded") -> {
      let assert Ok(_) =
        mist.send_text_frame(conn, msg_to_json("update", state))
      actor.continue(state)
    }
    mist.Text("UserClickedCounter") -> {
      // let new_state = increment_counter(state)
      let new_state = state
      let assert Ok(_) =
        mist.send_text_frame(conn, msg_to_json("update", new_state))
      actor.continue(new_state)
    }
    mist.Text(_) | mist.Binary(_) -> {
      actor.continue(state)
    }
    mist.Custom(Broadcast(text)) -> {
      let assert Ok(_) = mist.send_text_frame(conn, text)
      actor.continue(state)
    }
    mist.Closed | mist.Shutdown -> actor.Stop(process.Normal)
  }
}
