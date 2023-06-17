const express = require("express");
const cors = require("cors");
require("dotenv").config();
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const jwt = require("jsonwebtoken");
const stripe = require("stripe")(process.env.PAYMENT_SECRET_KEY);
const app = express();
const port = process.env.PORT || 5000;

app.use(express.json());
app.use(cors());

app.get("/", (req, res) => {
  res.send("Music Soul server is running");
});

const verifyJwt = (req, res, next) => {
  const authorization = req.headers.authorization;
  if (!authorization) {
    return res
      .status(401)
      .send({ error: true, message: "Unauthorized access" });
  }
  const token = authorization.split(" ")[1];
  jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, decoded) => {
    if (err) {
      return res
        .status(401)
        .send({ error: true, message: "Unauthorized access" });
    }
    req.decoded = decoded;
    next();
  });
};

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.c1nhv4b.mongodb.net/?retryWrites=true&w=majority`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

const usersCollections = client.db("musicSoulDb").collection("users");
const classesCollections = client.db("musicSoulDb").collection("classes");
const selectedCollections = client.db("musicSoulDb").collection("selects");
const paymentCollections = client.db("musicSoulDb").collection("payments");

async function run() {
  try {
    // Connect the client to the server	(optional starting in v4.7)
    // await client.connect();
    // Send a ping to confirm a successful connection

    // generate jwt token
    app.post("/jwt", (req, res) => {
      const email = req.body;
      const token = jwt.sign(email, process.env.ACCESS_TOKEN_SECRET, {
        expiresIn: "1h",
      });
      res.send({ token });
    });

    const verifyAdmin = async (req, res, next) => {
      const email = req.decoded.email;
      const query = { email: email };
      const user = await usersCollections.findOne(query);
      if (user?.role !== "admin") {
        return res
          .status(403)
          .send({ error: true, message: "Forbidden Access" });
      }
      next();
    };
    const verifyInstructor = async (req, res, next) => {
      const email = req.decoded.email;
      const query = { email: email };
      const user = await usersCollections.findOne(query);
      if (user?.role !== "instructor") {
        return res
          .status(403)
          .send({ error: true, message: "Forbidden Access" });
      }
      next();
    };
    const verifyStudent = async (req, res, next) => {
      const email = req.decoded.email;
      const query = { email: email };
      const user = await usersCollections.findOne(query);
      if (user?.role !== "student") {
        res.send({ error: true, message: "Forbidden Access" });
      }
      next();
    };

    // user related apis
    app.post("/users", async (req, res) => {
      const user = req.body;
      const query = { email: user.email };
      const existingUser = await usersCollections.findOne(query);
      if (existingUser) {
        return res.send({ message: "User already exist" });
      }
      const result = await usersCollections.insertOne(user);
      res.send(result);
    });
    app.get("/users", verifyJwt, verifyAdmin, async (req, res) => {
      const result = await usersCollections.find().toArray();
      res.send(result);
    });

    // admin related apis
    app.get("/users/admin/:email", verifyJwt, async (req, res) => {
      const email = req.params.email;
      const query = { email: email };
      if (req.decoded.email !== email) {
        return res.send({ admin: false });
      }
      const user = await usersCollections.findOne(query);
      const result = { admin: user?.role === "admin" };
      return res.send(result);
    });

    app.patch("/users/admin/:id", async (req, res) => {
      const id = req.params.id;
      const filter = { _id: new ObjectId(id) };
      const updateDoc = {
        $set: {
          role: "admin",
        },
      };
      const result = await usersCollections.updateOne(filter, updateDoc);
      res.send(result);
    });

    // instructor related apis
    app.patch("/users/instructor/:id", async (req, res) => {
      const id = req.params.id;
      const filter = { _id: new ObjectId(id) };
      const updateDoc = {
        $set: {
          role: "instructor",
        },
      };
      const result = await usersCollections.updateOne(filter, updateDoc);
      res.send(result);
    });

    // class related apis
    app.get("/classes", async (req, res) => {
      const query = {
        status: "approved",
      };
      const options = {
        sort: { enrolled: -1 },
      };
      const result = await classesCollections.find(query, options).toArray();
      res.send(result);
    });
    app.get("/allClasses", verifyJwt, verifyAdmin, async (req, res) => {
      const query = {};
      const options = {
        sort: { _id: -1 },
      };
      const result = await classesCollections.find(query, options).toArray();
      return res.send(result);
    });
    app.patch("/allClasses/approve/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const options = {
        $set: {
          status: "approved",
        },
      };
      const result = await classesCollections.updateOne(query, options);
      res.send(result);
    });
    app.patch("/allClasses/deny/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const options = {
        $set: {
          status: "denied",
        },
      };
      const result = await classesCollections.updateOne(query, options);
      res.send(result);
    });
    app.patch("/allClasses/feedback/:id", async (req, res) => {
      const id = req.params.id;
      const text = req.body;
      // console.log(text)
      const query = { _id: new ObjectId(id) };
      const options = {
        $set: text,
      };
      const result = await classesCollections.updateOne(query, options);
      res.send(result);
    });

    // instructor related apis
    app.get("/users/instructor/:email", verifyJwt, async (req, res) => {
      const email = req.params.email;
      const query = { email: email };
      if (req.decoded.email !== email) {
        return res.send({ instructor: false });
      }
      const user = await usersCollections.findOne(query);
      const result = { instructor: user?.role === "instructor" };
      return res.send(result);
    });

    app.get("/instructors", async (req, res) => {
      const query = {};
      const options = {
        sort: { enrolled: -1 },
      };
      const result = await classesCollections.find(query, options).toArray();
      res.send(result);
    });
    app.get("/instructor", async (req, res) => {
      const query = {
        status: "approved",
      };
      const result = await classesCollections.find(query).toArray();
      res.send(result);
    });
    app.get("/instructor/:id", async (req, res) => {
      const id = req.params.id;
      const filter = { _id: new ObjectId(id) };
      const singleClass = await classesCollections.findOne(filter);
      const query = { instructorEmail: singleClass.instructorEmail };
      const result = await classesCollections.find(query).toArray();
      res.send(result);
    });

    // student dashboard related apis
    app.post("/selected", async (req, res) => {
      const selectClass = req.body;
      const result = await selectedCollections.insertOne(selectClass);
      return res.send(result);
    });
    app.get("/selected", verifyJwt, async (req, res) => {
      const selectEmail = req.query.email;
      const decodedEmail = req.decoded.email;
      if (!selectEmail) {
        return res.send([]);
      }
      if (selectEmail !== decodedEmail) {
        return res
          .status(403)
          .send({ error: true, message: "Forbidden Access" });
      }
      const query = { studentEmail: selectEmail };
      const result = await selectedCollections.find(query).toArray();
      res.send(result);
    });
    app.delete("/selected/:id", verifyJwt, async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await selectedCollections.deleteOne(query);
      return res.send(result);
    });
    app.get("/selected/payment/:id", verifyJwt, async (req, res) => {
      const id = req.params.id;
      const decodedEmail = req.decoded.email;
      if (decodedEmail) {
        const query = { _id: new ObjectId(id) };
        const result = await selectedCollections.findOne(query);
        // console.log(result)
        res.send(result);
      }
    });
    app.get("/fromSelect/:id", async (req, res) => {
      const id = req.params.id;
      // console.log(id)
      const query = { _id: new ObjectId(id) };
      const result = await selectedCollections.findOne(query);
      // console.log(result)
      res.send(result);
    });
    app.delete("/fromSelect/:id", async (req, res) => {
      const id = req.params.id;
      const filter = { _id: new ObjectId(id) };
      // console.log(filter)
      const test = await classesCollections.findOne(filter);
      // console.log(test)
      const updateDoc = {
        $inc: {
          available_seat: -1,
          enrolled: +1,
        },
      };
      const updateResult = await classesCollections.updateOne(
        filter,
        updateDoc
      );

      const query = { classId: id };
      const deleteResult = await selectedCollections.deleteOne(query);
      // console.log(result)
      res.send({ updateResult, deleteResult });
    });

    app.get("/enrolledClass", verifyJwt, async (req, res) => {
      const email = req.query.email;
      const decodedEmail = req.decoded.email;
      if (!email) {
        return res.send([]);
      }
      if (email !== decodedEmail) {
        return res
          .status(403)
          .send({ error: true, message: "Forbidden Access" });
      }
      const query = { studentEmail: email };
      const result = await paymentCollections.find(query).toArray();
      res.send(result);
    });
    app.get("/paymentHistory", verifyJwt, async (req, res) => {
      const email = req.query.email;
      const decodedEmail = req.decoded.email;
      if (!email) {
        return res.send([]);
      }
      if (email !== decodedEmail) {
        return res
          .status(403)
          .send({ error: true, message: "Forbidden Access" });
      }
      const query = { studentEmail: email };
      const options = {
        sort: { date: -1 },
      };
      const result = await paymentCollections.find(query, options).toArray();
      res.send(result);
    });

    // payment related api
    app.post("/create-payment-intend", verifyJwt, async (req, res) => {
      const { price } = req.body;
      const amount = parseFloat(price * 100);
      const paymentIntent = await stripe.paymentIntents.create({
        amount: amount,
        currency: "usd",
        payment_method_types: ["card"],
      });
      res.send({
        clientSecret: paymentIntent.client_secret,
      });
    });
    app.post("/payments", async (req, res) => {
      const payment = req.body;
      const result = await paymentCollections.insertOne(payment);
      res.send(result);
    });

    // instructor dashboard related apis
    app.get(
      "/myClass/:email",
      verifyJwt,
      verifyInstructor,
      async (req, res) => {
        const email = req.params.email;
        // const decodedEmail = req.decoded.email;
        // if(!selectEmail){
        //     res.send([])
        // }
        // if(selectEmail !== decodedEmail){
        //     return res.status(403).send({error: true, message: 'Forbidden Access'})
        // }
        // console.log(email)
        const query = { instructorEmail: email };
        const result = await classesCollections.find(query).toArray();
        res.send(result);
      }
    );
    app.post("/addClass", async (req, res) => {
      const classInfo = req.body;
      const result = await classesCollections.insertOne(classInfo);
      res.send(result);
    });

    await client.db("admin").command({ ping: 1 });
    console.log(
      "Pinged your deployment. You successfully connected to MongoDB!"
    );
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);

app.listen(port, (req, res) => {
  console.log("Music Soul server is running port", port);
});
