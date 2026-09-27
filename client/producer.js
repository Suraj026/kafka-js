import net from "node:net";

const client = net.createConnection({ port : 9092 }, () => {
    // create a connection to server
    console.log("Connected to server!");   
    
    // send data to server
    const dataToSend = "Hello from client";
    client.write(dataToSend);
});

// handle "data" event when server responds
client.on("data", (data) => {
    console.log(`Got : ${data.toString()} of length ${data.length}`);
    client.end();
});

// handle "error" event when server is not live
client.on("error", (err) => {
    console.log(err.message);
});