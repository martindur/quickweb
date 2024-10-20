function clearEventListeners() {
  document.querySelectorAll('[q-event]').forEach(element => {
    const newElement = element.cloneNode(true); // Clone without event listeners
    element.replaceWith(newElement); // Replace the old element with the new one
  });
}

function bindEvents(socket, model) {
  document.querySelectorAll('[q-event]').forEach(element => {
    const eventExpression = element.getAttribute('q-event');
    const [eventType, handlerWithParams] = eventExpression.split(':');

    // Parse the handler and params, e.g., 'DeletePost(blogs.1.id)'
    const [handler, params] = handlerWithParams.match(/([^(]+)\(([^)]+)?\)/).slice(1, 3);

    // Add event listener
    element.addEventListener(eventType, () => {
      // Resolve the keys dynamically using the passed model
      const paramValues = resolveKeys(params.split(','), model);
      sendMessageToServer(handler, paramValues, socket);
    });
  });
}

function resolveKeys(keys, model) {
  console.log(keys)
  console.log(model)
  // Resolve each key in the model to get the latest values
  // return keys.map(key => eval(`model.${key.trim()}`));
  return keys.map(key => model[key]);
}

function sendMessageToServer(handler, params, socket) {
    const message = `${handler}(${params.join(', ')})`;
    console.log("Sending message to server:", message);
    // socket.send(message); // Send the message via WebSocket
}

function flattenModel(obj, parentKey = '', result = {}) {
    if (Array.isArray(obj)) {
        obj.forEach((item, index) => {
            flattenModel(item, `${parentKey}.${index}`, result); // Handle array item with index
        });
    } else if (typeof obj === 'object' && obj !== null) {
        for (let key in obj) {
            const fullKey = parentKey ? `${parentKey}.${key}` : key;
            flattenModel(obj[key], fullKey, result); // Recursively flatten objects
        }
    } else {
        result[parentKey] = obj; // Assign non-object, non-array value directly
    }
    return result;
}


function generateListItems(model) {
  document.querySelectorAll('[q-bind-list]').forEach(listElement => {
    const listKey = listElement.getAttribute('q-bind-list');

    if (model[listKey] === undefined) return;

    const parent = listElement.parentElement;
    const template = listElement.cloneNode(true); // Clone the template

    // Remove the original template from the DOM
    listElement.remove();

    // Create list items for each entry in the list
    model[listKey].forEach((_, index) => {
      const itemElement = template.cloneNode(true); // Clone the template for each item

      // Assign q-bind to the <li> itself
      itemElement.setAttribute('q-bind', `${listKey}.${index}`);

      // Update inner q-bind elements within the item
      itemElement.querySelectorAll('[q-bind], [q-event]').forEach(child => {
        if (child.hasAttribute('q-bind')) {
          const bindKey = child.getAttribute('q-bind');
          child.setAttribute('q-bind', bindKey.replace('@', index)); // Replace @ with the actual index
        }

        if (child.hasAttribute('q-event')) {
          const bindKey = child.getAttribute('q-event');
          child.setAttribute('q-event', bindKey.replace('@', index)); // Replace @ with the actual index
        }

      });

      itemElement.removeAttribute('q-bind-list'); // Prevent re-processing as a list template
      parent.appendChild(itemElement); // Append to the parent
    });
  });
}


function bindModel(model, socket) {
  const flattenedModel = flattenModel(model); // Flatten the model
  generateListItems(model)
    
  for (const key in flattenedModel) {
    document.querySelectorAll(`[q-bind*="${key}"]`).forEach(element => {
      if (element) {
        const bindValue = element.getAttribute('q-bind')
        const [attribute, modelKey] = bindValue.includes(':') ? bindValue.split(':') : [null, bindValue]

        const value = flattenedModel[modelKey]

        if (attribute) {
          element.setAttribute(attribute, value)
        } else {
          element.textContent = value;
        }
      }
    })
  }

  clearEventListeners()
  bindEvents(socket, flattenedModel)
}


const load = () => {
  const socket = new WebSocket('ws://localhost:3000/ws')

  // When the WebSocket connection is established
  socket.addEventListener('open', (event) => {
      console.log('WebSocket is connected.');
      // You can send data to the server, if needed
      socket.send('PageLoaded');
  });

  // When receiving a message from the WebSocket server
  socket.addEventListener('message', (event) => {
    let message;
    try {
      message = JSON.parse(event.data);
    } catch (error) {
      console.error('Invalid JSON:', event.data)
      return;
    }

    switch (message.msg) {
      case 'update':
        bindModel(message.model, socket)
        break;
      default:
        console.warn('Unknown message type:', message.type)
    }
  });

  // When WebSocket connection is closed
  socket.addEventListener('close', (event) => {
      console.log('WebSocket connection closed.');
  });
}

const setup = () => {
  document.addEventListener('DOMContentLoaded', load)
}

setup();
