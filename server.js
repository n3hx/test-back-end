var express = require("express");
let app = express();
const cors = require("cors");
const path = require("path");
let PropertiesReader = require("properties-reader");
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");

// Middleware setup

// CORS middleware: Allows Cross-Origin Resource Sharing, enabling requests from different domains.
app.use(cors());

// JSON parser middleware: Parses incoming JSON payloads into `req.body`.
app.use(express.json());

// Logger middleware: Logs details about each request to the server console.
//Logs the HTTP method, URL, and timestamp for every request.
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
  next(); // Pass control to the next middleware
});

// Static file middleware: Serves static files from the current directory.
app.use(express.static(path.join(__dirname)));

// Image middleware: Handles requests for images and returns an error if the image file does not exist.
app.use("/images", (req, res, next) => {
  const imagePath = path.join(__dirname, "images", req.path);
  res.sendFile(imagePath, (err) => {
    if (err) {
      console.error(`Image not found: ${imagePath}`);
      res.status(404).json({ error: "Image not found" });
    }
  });
});

// Pretty-print JSON responses.
app.set("json spaces", 3);

// Load database connection properties
let propertiesPath = path.resolve(__dirname, "./dbconnection.properties");
let properties = PropertiesReader(propertiesPath);

// Extract values from the properties file
const dbPrefix = properties.get("db.prefix");
const dbHost = properties.get("db.host");
const dbName = properties.get("db.name");
const dbUser = properties.get("db.user");
const dbPassword = properties.get("db.password");
const dbParams = properties.get("db.params");

// MongoDB connection setup
const uri = `${dbPrefix}${dbUser}:${dbPassword}${dbHost}${dbParams}`;
const client = new MongoClient(uri, { serverApi: ServerApiVersion.v1 });

let db1;

// MongoDB connection
async function connectDB() {
  try {
    await client.connect(); //The code execution pauses at the await statement until the Promise resolves or rejects.
    //If the Promise resolves, await returns the resolved value.
    console.log("Connected to MongoDB");
    db1 = client.db(dbName);
  } catch (err) {
    console.error("MongoDB connection error:", err);
  }
}

connectDB();

// Reference to the collections
const lessonsCollection = () => db1.collection("lessons");
const ordersCollection = () => db1.collection("order_placed");

// Routes

// Get all lessons
app.get("/lessons", async (req, res) => {
  try {
    const lessons = await lessonsCollection().find({}).toArray();
    res.json(lessons);
  } catch (err) {
    console.error("Error fetching lessons:", err);
    res.status(500).json({ error: "Failed to fetch lessons" });
  }
});

// Get a lesson by ID
app.get("/lessons/:id", async (req, res) => {
  try {
    const lessonId = req.params.id;
    const lesson = await lessonsCollection().findOne({ _id: new ObjectId(lessonId) });

    if (lesson) {
      res.json(lesson);
    } else {
      res.status(404).json({ error: "Lesson not found" });
    }
  } catch (err) {
    console.error("Error fetching lesson by ID:", err);
    res.status(500).json({ error: "Failed to fetch lesson" });
  }
});

// Serve index.html file
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "index.html"));
});

// Add a new lesson
app.post("/lessons", async (req, res) => {
  try {
    const lesson = req.body;
    const result = await lessonsCollection().insertOne(lesson);
    res.status(201).json({
      ...lesson,
      _id: result.insertedId,
    });
  } catch (err) {
    console.error("Error adding lesson:", err);
    res.status(500).json({ error: "Failed to add lesson" });
  }
});

// Update spaces for multiple lessons
// Define a PUT endpoint to update the "spaces" field for multiple lessons.
app.put("/lessons/updateSpaces", async (req, res) => {
  try {
    // Extract the array of updates from the request body. Each update contains an `id` and `spaces` field.
    const updates = req.body;

    // Map over the updates to create a list of bulk operations for MongoDB.
    const bulkOperations = updates.map((update) => ({
      updateOne: { // Specifies that each operation is an "updateOne" action.
        filter: { _id: new ObjectId(update.id) }, // The filter identifies the document to update by its `_id`.
        update: { $set: { spaces: update.spaces } }, // Sets the new value for the `spaces` field.
      },
    }));

    // Perform all the bulk write operations in a single request to the MongoDB server.
    const result = await lessonsCollection().bulkWrite(bulkOperations);

    // Send a success response to the client with a message and the result of the operation.
    res.json({ message: "Spaces updated successfully", result });
  } catch (err) {
    // Log the error to the console for debugging.
    console.error("Error updating spaces:", err);

    // Send an error response to the client with a 500 status code.
    res.status(500).json({ error: "Failed to update spaces" });
  }
});

// Update a lesson by ID
app.put("/lessons/:id", async (req, res) => {
  try {
    const updatedLesson = req.body;
    await lessonsCollection().updateOne(
      { _id: new ObjectId(req.params.id) },
      { $set: updatedLesson }
    );
    res.json({ message: "Lesson updated successfully" });
  } catch (err) {
    console.error("Error updating lesson:", err);
    res.status(500).json({ error: "Failed to update lesson" });
  }
});

// Delete a lesson by ID
app.delete("/lessons/:id", async (req, res) => {
  try {
    await lessonsCollection().deleteOne({ _id: new ObjectId(req.params.id) });
    res.json({ message: "Lesson deleted successfully" });
  } catch (err) {
    console.error("Error deleting lesson:", err);
    res.status(500).json({ error: "Failed to delete lesson" });
  }
});

// Add a new order
app.post("/order_placed", async (req, res) => {
  try {
    const order = req.body;
    await ordersCollection().insertOne(order);
    res.status(201).json({ message: "Order placed successfully" });
  } catch (err) {
    console.error("Error placing order:", err);
    res.status(500).json({ error: "Failed to place order" });
  }
});

// Get all placed orders
app.get("/order_placed", async (req, res) => {
  try {
    const orders = await ordersCollection().find({}).toArray();
    res.json(orders);
  } catch (err) {
    console.error("Error fetching orders:", err);
    res.status(500).json({ error: "Failed to fetch orders" });
  }
});

// Global error handler: Catches any errors and sends a generic error response.
app.use((err, req, res, next) => {
  console.error("Global error handler:", err);
  res.status(500).json({ error: "An error occurred" });
});

// Start the server
app.listen(3000, () => {
  console.log("Server is running on port 3000");
});
