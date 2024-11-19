require("dotenv").config();
const express = require("express");
const { OpenAI } = require("openai"); // Using OpenAI SDK
const cors = require("cors");

// Initialize express app
const app = express();
const port = 3000;

// Apply CORS middleware
app.use(cors());

// Initialize OpenAI with the API key (using .env for secure handling)
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Middleware to handle errors globally
app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(500).send("Something went wrong");
});

// Middleware to parse JSON and increase the limit for base64 image uploads
app.use(express.json({ limit: "10mb" }));

// Root request handler (GET /)
app.get("/", (req, res) => {
  res.send("Backend server is running");
});

// POST endpoint to analyze shoe image
app.post("/analyze-shoe", async (req, res) => {
  console.log("Received a POST request to /analyze-shoe"); // Debugging line
  try {
    const { base64Image, problemDescription, affectedPart } = req.body;

    // Check if base64 image is provided
    if (!base64Image) {
      return res.status(400).send("No image provided");
    }

    // Construct the user prompt for OpenAI Vision API
    let prompt = `
    You are a shoe product e-shop assistant trained to identify shoe models, and materials, and provide cleaning recommendations. The customer has uploaded a photo of a shoe and described the problem. Based on this, your task is to:

     Analyze the shoe in the provided image and return the information in the following format:
    
    {
      "brandAndModel": "Shoe brand and model name",
      "materials": {
        "upper": "Material of the upper, if visible. If not visible, suggest using the model name to determine the material.",
        "lining": "Material of the lining, if visible. If not visible, suggest using the model name to determine the material.",
        "insole": "Material of the insole, if visible. If not visible, suggest using the model name to determine the material.",
        "outsole": "Material of the outsole, if visible. If not visible, suggest using the model name to determine the material.",
        "laces": "Material of the laces, if visible. If not visible, suggest using the model name to determine the material.",
        "tongue": "Material of the tongue, if visible. If not visible, suggest using the model name to determine the material."
      },
      "cleaningRecommendations": [
        {
          "affectedPart": "The affected part of the shoe (e.g., Upper, Outsole, Toe, Heel, etc.)",
          "recommendations": [
            "List of cleaning recommendations for that part, based on the described problem."
          ]
        }
      ],
      "generalCare": ["General care tips for the shoe, based on the model and also the problem that was given so it wouldn't repeat. "]
    }
    
# Notes

-The model name should be used to suggest materials for any visible parts that are not identifiable.
-If the problem and affected parts are visible, provide the appropriate cleaning recommendations. 
-If multiple parts are affected, provide multiple recommendations.
- If the brand and model cannot be recognized, provide your best estimate or mark it as "unknown."
- In cases where part of the material cannot be clearly identified, use "unspecified" or "possibly [type]" for transparency.
- Be as specific as possible, but avoid guessing if the information is not recognizable.
- Please format the response as JSON with the appropriate details based on the shoe in the image.

#Customers input


    `;

    if (problemDescription) {
      prompt += ` The customer has described the following issue: "${problemDescription}".`;
    }
    if (affectedPart) {
      prompt += ` The affected part of the shoe is: "${affectedPart}".`;
    }

    // Make the API call to OpenAI with the image and prompt
    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: [
            {
              type: "text",
              text: prompt,
            },
          ],
        },
        {
          role: "user",
          content: [
            {
              type: "image_url",
              image_url: {
                url: `data:image/jpeg;base64,${base64Image}`,
                detail: "high", // Base64-encoded image
              },
            },
          ],
        },
      ],
      temperature: 1,
      max_tokens: 2048,
      top_p: 1,
      frequency_penalty: 0,
      presence_penalty: 0,
      response_format: {
        type: "json_object",
      },
    });

    console.log("API Response:", response);

    // Send the formatted response back to the client
    res.json(response.choices[0].message.content);
  } catch (error) {
    console.error("Error processing image:", error);
    res.status(500).send("Error processing image");
  }
});

// Start the Express server
app.listen(3000, "0.0.0.0", () => {
  console.log("Server running on http://0.0.0.0:3000");
});
