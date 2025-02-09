# @elum/ews Package Documentation

## Overview
The `@elum/ews` package provides an interface for interacting with a WebSocket server. It supports automatic connection and reconnection and offers functionality to send and process requests using Promises or callbacks.

## Installation

Install the package via npm:

```bash
npm install @elum/ews
```

## Types for Requests and Responses

Before using `init`, define the types for requests and responses:

```typescript
export type Socket = {
    "user.get": {
        "request": {
            name: string; // Name of the user to fetch data for
        };
        "response": {
            value: number; // Response containing a numeric value
        };
    }
}
```

## Initializing the Connection

Create a connection to the WebSocket server using the `init` function:

```typescript
import init from '@elum/ews';

export const socket = init<Socket>({
    url: "wss://dev.elum.app", // WebSocket server URL
    autoConnect: false, // Automatically connect on initialization if true
    autoReconnect: true // Reconnect automatically if connection is lost
});
```

## Available Functions

### Get Connection Status

Returns the current connection status as a string:

```typescript
import { socket } from "state"; // Import socket instance
const status = socket.status(); // Get current connection status
console.log("Current connection status: ", status);
```

### Connect

Use `connect` to establish a connection:

```typescript
import { socket } from "state";

socket.connect(); // Manually establish a connection to the server
```

### Disconnect

Disconnect from the server by calling `disconnect`:

```typescript
import { socket } from "state";

socket.disconnect(); // Disconnect from the server gracefully
```

### Terminate Connection

Terminate the WebWorker and clean up resources:

```typescript
import { socket } from "state";

socket.terminate(); // Terminate the worker and free resources
```

### Sending Requests

You can send requests using either Promises or callbacks. Both methods allow you to receive a response from the server.

**Using Promises:**

```typescript
import { socket } from "state";

const handlerOpenGet = async () => {
    try {
        const data = await socket.send("user.get", {
            name: "FRANK" // Name of the user to fetch
        });
        console.log("Promise data: ", data); // Log the received data
    } catch (error) {
        console.error("Error fetching data: ", error); // Handle errors
    }
};
```

**Using Callbacks:**

```typescript
import { socket } from "state";

socket.send("user.get", {
    name: "FRANK" // Name of the user to fetch
}, (data) => {
    console.log("Callback data: ", data); // Log data from the callback
});
```

### Handling Events

Subscribe to events and handle incoming data using `onEvents`:

```typescript
import { socket } from "state";

socket.onEvents((data) => {
    switch (data.event) {
        case "user.get":
            console.log(data.event, data.data); // Log event name and data
    }
});
```
