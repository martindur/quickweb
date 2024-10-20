import gleam/bytes_builder
import gleam/dynamic.{type Dynamic, classify, from}
import gleam/erlang
import gleam/erlang/process
import gleam/http/request.{type Request}
import gleam/http/response.{type Response}
import gleam/io
import gleam/json.{type Json}
import gleam/list
import gleam/option.{None, Some}
import gleam/otp/actor.{type Next}
import gleam/result
import gleam/string
import mist.{
  type Connection, type ResponseData, type WebsocketConnection,
  type WebsocketMessage,
}

// TODO: Let's make the interface for the backend
// as "how we want to use it". I think a msg handler approach is
// pretty good. We can have some variants like IntHandler(Model, Int) and StringHandler(Model, String)
// For simple one arg handlers. And then a DynamicHandler(Model, Dynamic) which could be anything?

pub fn jsonify(a: Dynamic) -> Json {
  case classify(a) {
    "String" -> result.unwrap(dynamic.string(a), "") |> json.string
    "Int" -> result.unwrap(dynamic.int(a), 0) |> json.int
    "Float" -> result.unwrap(dynamic.float(a), 0.0) |> json.float
    // "Tuple of 4 elements" -> 
    any -> {
      any |> io.debug
      a |> io.debug
      json.string("bob")
    }
  }
}

pub fn run(
  handler: fn(model, WebsocketConnection, WebsocketMessage(a)) -> Next(a, model),
  model: model,
) {
  let not_found =
    response.new(404)
    |> response.set_body(mist.Bytes(bytes_builder.new()))

  let selector = process.new_selector()

  let assert Ok(_) =
    fn(req: Request(Connection)) -> Response(ResponseData) {
      case request.path_segments(req) {
        [] -> serve_file("./priv/pages/", ["index.html"])
        ["static", "quickweb.js"] -> {
          case erlang.priv_directory("quickweb") {
            Ok(dir) -> serve_file(dir <> "/static", ["quickweb.js"])
            Error(Nil) -> serve_file("./priv/static", ["quickweb.js"])
          }
        }
        // TODO: We probably also want this to be priv_directory
        ["static", ..rest] -> serve_file("./priv/static", rest)
        ["ws"] ->
          mist.websocket(
            request: req,
            on_init: fn(_conn) { #(model, Some(selector)) },
            on_close: fn(_state) { io.println("goodbye!") },
            handler: handler,
          )
        page -> serve_file("./priv/pages/", page)
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
// pub type MyMessage {
//   Broadcast(String)
// }
