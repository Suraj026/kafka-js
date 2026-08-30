import net from "node:net";
import { Buffer } from 'node:buffer';

const client = net.createConnection({ port : 9092}, () => {
    // create a connection to server
    console.log("Connected to server!");   
    
    // send data to server
    const buf = Buffer.alloc(100000);
    client.write(buf);
});

// handle "data" event when server responds
client.on("data", (data) => {
    console.log(`Got : ${data}`);
});

// handle "error" event when server is not live
client.on("error", (err) => {
    console.log(err.message);
});