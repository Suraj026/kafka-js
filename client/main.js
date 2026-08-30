import net from "node:net";

const client = net.createConnection({ port : 9092}, () => {
    console.log("Connected to server!");
})