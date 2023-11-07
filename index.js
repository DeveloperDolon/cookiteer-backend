require("dotenv").config();
const express = require('express');
const app = express();
const cors = require('cors');
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
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

const verifyToken = (req, res, next) => {
  const token = req?.cookies?.token;

  if(!token) {
    return res.status(401).send({message: "Unauthorized Access!"})
  }

  jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, decode) => {
    if(err) {
      return res.status(401).send({message: "Unauthorized Access!!"});
    }

    req.user = decode;
    next();
  })
}

async function run() {
  try {
    // Connect the client to the server	(optional starting in v4.7)
    await client.connect();
    // Send a ping to confirm a successful connection

    const foodCollection = client.db("cookiteerDB").collection("foodsCollection");
    const requestedFoodsCollection = client.db("cookiteerDB").collection("requestedFoodsCollection");

    // jwt authorization api is here
    app.post("/api/v1/jwt", logger,(req, res) => {
      try{
        const user = req.body;
        const token = jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, {expiresIn: "6h"});

        res.cookie('token', token, {
          httpOnly: true,
          secure: false,
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
    app.get("/api/v1/food-requests", verifyToken, logger, async (req, res) => {
      try{

        if(req?.query?.email !== req?.user?.user) {
          return res.status(403).send({message: "Forbidden Access!"});
        }

        const email = req.query.email;
        const query = {requesterEmail: email};

        const option = {
          projection: {foodName: 1, foodImage: 1, donarName: 1, pickUpLocation: 1, expiredDate: 1, requestDate: 1, donateMoney : 1, status: 1}
        }

        const result = await requestedFoodsCollection.find(query, option).toArray();
        res.send(result);

      } catch (err) {
        console.log(err.message);
      }
    })

    app.delete("/api/v1/food-requests/:id", logger, async (req, res) => {
      try {
        const id = req.params.id;
        const query = {_id: new ObjectId(id)};

        const result = await requestedFoodsCollection.deleteOne(query);
        res.send(result);
      } catch (err) {
        console.log(err.message);
      }
    })

    app.post("/api/v1/food-requests", logger, async (req, res) => {
      try{
        const requestData = req.body;
        const query = {foodId : requestData.foodId};
        const isExist = await requestedFoodsCollection.findOne(query);

        if(isExist) {
          return res.status(409).send({message: "Conflict"});
        }

        const result = await requestedFoodsCollection.insertOne(requestData);
        res.send(result);
      } catch(err){
        console.log(err.message);
      }
    })



    app.get("/api/v1/foods/:id", logger, async(req, res) => {
      try{
        const id = req.params.id;
        const query = {_id: new ObjectId(id)};
        const result = await foodCollection.findOne(query);

        res.send(result);
      } catch(err){
        console.log(err.message);
      }
    })

    app.delete("/api/v1/foods/:id", logger, async (req, res) => {
      try{

        const id = req.params.id;
        const query = {_id: new ObjectId(id)};

        const result = await foodCollection.deleteOne(query);

        res.send(result);

      } catch(err) {
        console.log(err.message);
      }
    })

    app.patch("/api/v1/update-food/:id", logger, async (req, res) => {
      try{
        const id = req.params.id;
        const query = {_id: new ObjectId(id)};
        const updateData = req.body;
        const updateDoc = {
          $set: {
            foodName: updateData.foodName,
            foodImage: updateData.foodImage,
            foodQuantity: updateData.foodQuantity,
            expiredDate: updateData.expiredDate,
            pickUpLocation: updateData.pickUpLocation,
            category: updateData.category,
            additionalNotes: updateData.additionalNotes,
          }
        }

        const result = await foodCollection.updateOne(query, updateDoc);
        res.send(result);
      } catch(err){
        console.log(err.message);
      }
    })

    app.post("/api/v1/add-food", logger, async (req, res) => {
      try{
        const foodInfo = req.body;
        const result = await foodCollection.insertOne(foodInfo);
        res.send(result);
      } catch(err) {
        console.log(err.message);
      }
    })

    app.get("/api/v1/foods", logger, async (req, res) => {
      try{
        let categoryText = req?.query?.category;
        let sortingProcess = "";
        let query = {};
        let options = {};
        let searchQuery = req?.query?.search;

        if(req.query) {
          if(categoryText) { 
            if(req.query.category.search("And") > 0) {
              categoryText = req.query.category.replace(/And/gi, "&");
            }
            query = {category : categoryText};
          }
        }

        if(searchQuery) {
          query = {foodName: {$regex: searchQuery, $options: 'i'}};
        }

        if(req.query.sort && req.query.sortItem === "expiredDate") {
          sortingProcess = req.query.sort;
          options = {
            sort: {
              expiredDate : sortingProcess === "asc" ? 1 : -1
            }
          }
        }

        if(req.query.sort && req.query.sortItem === "foodQuantity") {
          sortingProcess = req.query.sort;

          options = {
            sort: {
              foodQuantity : sortingProcess === "asc" ? 1 : -1,
            }
          }
        }
        
        const cursor = foodCollection.find(query, options);
        const result = await cursor.toArray();
        res.send(result);

      } catch(err) {
        console.log(err.message);
      }
    })

    app.get("/api/v1/manage-food", logger, verifyToken, async (req, res) => {
      try {
          if(req?.query.email !== req?.user?.user) {
            return res.status(403).send({message: "Forbidden Access!"});
          }

          const query = {donarEmail : req.query.email};
          const result = await foodCollection.find(query).toArray();

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