const qClick = (socket) => {
  document.querySelectorAll('[q-click]').forEach(element => {
    const value = element.getAttribute('q-click')
    if (value) {
    element.addEventListener('click', () => {
      socket.send(value);
    })
    }
  })
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
      itemElement.querySelectorAll('[q-bind]').forEach(child => {
        const bindKey = child.getAttribute('q-bind');
        child.setAttribute('q-bind', bindKey.replace('@', index)); // Replace @ with the actual index
      });

      itemElement.removeAttribute('q-bind-list'); // Prevent re-processing as a list template
      parent.appendChild(itemElement); // Append to the parent
    });
  });
}


function bindModel(model) {
  const flattenedModel = flattenModel(model); // Flatten the model
  console.log(flattenedModel)
  generateListItems(model)
    
  for (const key in flattenedModel) {
    const element = document.querySelector(`[q-bind="${key}"]`);
    if (element) {
      element.textContent = flattenedModel[key]; // Bind the value to the DOM
    }
  }
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

    // update(message.model);
    bindModel(message.model)

    switch (message.msg) {
      case 'update':
        bindModel(message.model)
        break;
      default:
        console.warn('Unknown message type:', message.type)
    }
  });

  // When WebSocket connection is closed
  socket.addEventListener('close', (event) => {
      console.log('WebSocket connection closed.');
  });

  qClick(socket);
}

const setup = () => {
  document.addEventListener('DOMContentLoaded', load)
}

setup();
