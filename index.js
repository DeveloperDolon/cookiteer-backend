require("dotenv").config();
const express = require('express');
const app = express();
const cors = require('cors');
const port = process.env.PORT || 5000;


app.use(express.json());
app.use(cors());

app.get("/", (req, res) => {
    res.send("Welcome to assignment 11 backend😬!!");
})

app.listen(port, () => {
    console.log("listening on port " + port);
});