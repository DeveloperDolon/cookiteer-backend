require("dotenv").config();
const express = require('express');
const app = express();
const cors = require('cors');
const { MongoClient, ServerApiVersion } = require('mongodb');
const port = process.env.PORT || 5000;
const jwt = require('jsonwebtoken');
const cookieParser = require('cookie-parser');


app.use(express.json());
app.use(cookieParser());
app.use(cors({
  origin: [
    "http://localhost:5173"
  ],
  credentials: true
}));

const uri = `mongodb+srv://${process.env.DATA_USERNAME}:${process.env.DATA_PASSWORD}@cluster0.evacz3b.mongodb.net/?retryWrites=true&w=majority`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  }
});

const logger = (req, res, next) => {
  console.log("log info", req.method, req.url);
  next();
}

async function run() {
  try {
    // Connect the client to the server	(optional starting in v4.7)
    await client.connect();
    // Send a ping to confirm a successful connection

    const foodCollection = client.db("cookiteerDB").collection("foodsCollection");

    // jwt authorization api is here
    app.post("/api/v1/jwt", logger,(req, res) => {
      try{
        const user = req.body;
        const token = jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, {expiresIn: "6h"});

        res.cookie('token', token, {
          httpOnly: true,
          secure: false,
          sameSite: "none"
        }).send({success : true});
      } catch(err) {
        console.log(err.message);
      }
    })

    app.post("/api/v1/logout", logger, (req, res) => {
      try{
        res.clearCookie('token', {maxAge: 0}).send({logout: true});
        console.log("user logout ",req.body);
      } catch(err) {
        console.log(err.message);
      }
    }) 


    // foods related api methods are here
    app.post("/api/v1/add-food", logger, async (req, res) => {
      try{
        const foodInfo = req.body;
        const result = await foodCollection.insertOne(foodInfo);
        res.send(result);
      } catch(err) {
        console.log(err.message);
      }
    })

    app.get("/api/v1/foods", async (req, res) => {
      try{
        const result = await foodCollection.find().toArray();
        res.send(result);
      } catch(err) {
        console.log(err.message);
      }
    })

    await client.db("admin").command({ ping: 1 });
    console.log("Pinged your deployment. You successfully connected to MongoDB!");
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);


app.get("/", (req, res) => {
    res.send("Welcome to assignment 11 backend😬!!");
})

app.listen(port, () => {
    console.log("listening on port " + port);
});