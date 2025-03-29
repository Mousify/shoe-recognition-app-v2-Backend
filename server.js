require("dotenv").config();
const express = require("express");
const { OpenAI } = require("openai");
const cors = require("cors");
const fs = require("fs");
const path = require("path");
const csv = require("csv-parser");

// Initialize express app
const app = express();
const port = process.env.PORT || 3000;

// Apply CORS middleware
app.use(cors());

// Initialize OpenAI with the API key
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
  res.send("AI Shoe Assistant Backend Server is running");
});

// Products database
let productsDatabase = [];

// Load products from CSV
function loadProductsDatabase() {
  const results = [];

  fs.createReadStream(path.join(__dirname, "products_export.csv"))
    .pipe(csv())
    .on("data", (data) => results.push(data))
    .on("end", () => {
      productsDatabase = results;
      console.log(`Loaded ${results.length} products into database`);
    })
    .on("error", (error) => {
      console.error("Error loading products database:", error);
    });
}

// Find relevant products based on shoe details
function findRelevantProducts(shoeDetails) {
  if (productsDatabase.length === 0) {
    return [];
  }

  // Extract relevant keywords from shoe details
  const keywords = [];

  // Add brand and model if available
  if (shoeDetails.brandAndModel) {
    const brandModelWords = shoeDetails.brandAndModel.toLowerCase().split(" ");
    keywords.push(...brandModelWords);
  }

  // Add materials if available
  if (shoeDetails.materials) {
    Object.values(shoeDetails.materials).forEach((material) => {
      if (material) {
        keywords.push(material.toLowerCase());
      }
    });
  }

  // Add affected parts and problems if available
  if (shoeDetails.cleaningRecommendations) {
    shoeDetails.cleaningRecommendations.forEach((rec) => {
      if (rec.affectedPart) {
        keywords.push(rec.affectedPart.toLowerCase());
      }
    });
  }

  // Filter products based on keywords
  const relevantProducts = productsDatabase.filter((product) => {
    // Check if product title, description, or tags match any keywords
    const productText =
      `${product.Title} ${product["Body (HTML)"]} ${product.Tags}`.toLowerCase();
    return keywords.some((keyword) => productText.includes(keyword));
  });

  // Return top 5 most relevant products
  return relevantProducts.slice(0, 5).map((product) => ({
    id: product.Handle,
    title: product.Title,
    price: product["Variant Price"]
      ? `$${product["Variant Price"]}`
      : "Price not available",
    image:
      product["Image Src"] ||
      "https://via.placeholder.com/200x150?text=No+Image",
    url: `https://example.com/products/${product.Handle}`,
  }));
}

// Translations for different languages
const translations = {
  en: {
    systemPrompt:
      "You are a shoe product e-shop assistant trained to identify shoe models, materials, and provide cleaning recommendations.",
    responseFormat: {
      brandAndModel: "Shoe brand and model name",
      materials: {
        upper: "Material of the upper",
        lining: "Material of the lining",
        insole: "Material of the insole",
        outsole: "Material of the outsole",
        laces: "Material of the laces",
        tongue: "Material of the tongue",
      },
      cleaningRecommendations: [
        {
          affectedPart: "The affected part of the shoe",
          recommendations: ["List of cleaning recommendations"],
        },
      ],
      generalCare: ["General care tips for the shoe"],
    },
  },
  es: {
    systemPrompt:
      "Eres un asistente de tienda de calzado entrenado para identificar modelos de zapatos, materiales y proporcionar recomendaciones de limpieza.",
    responseFormat: {
      brandAndModel: "Marca y modelo del zapato",
      materials: {
        upper: "Material de la parte superior",
        lining: "Material del forro",
        insole: "Material de la plantilla",
        outsole: "Material de la suela",
        laces: "Material de los cordones",
        tongue: "Material de la lengüeta",
      },
      cleaningRecommendations: [
        {
          affectedPart: "La parte afectada del zapato",
          recommendations: ["Lista de recomendaciones de limpieza"],
        },
      ],
      generalCare: ["Consejos generales de cuidado para el zapato"],
    },
  },
  // Add more languages as needed
};

// POST endpoint to analyze shoe image
app.post("/analyze-shoe", async (req, res) => {
  console.log("Received a POST request to /analyze-shoe");
  try {
    const {
      base64Image,
      problemDescription,
      affectedPart,
      brand,
      language = "en",
    } = req.body;

    // Check if base64 image is provided
    if (!base64Image) {
      return res.status(400).send("No image provided");
    }

    // Check image quality
    const imageQualityIssue = await checkImageQuality(base64Image);
    if (imageQualityIssue) {
      return res
        .status(400)
        .json({ error: "image_quality", message: imageQualityIssue });
    }

    // Get translation for selected language or default to English
    const translation = translations[language] || translations.en;

    // Construct the user prompt for OpenAI Vision API
    let prompt = `
    ${translation.systemPrompt}

    Analyze the shoe in the provided image and return the information in the following format:
    
    {
      "brandAndModel": "${translation.responseFormat.brandAndModel}",
      "materials": {
        "upper": "${translation.responseFormat.materials.upper}",
        "lining": "${translation.responseFormat.materials.lining}",
        "insole": "${translation.responseFormat.materials.insole}",
        "outsole": "${translation.responseFormat.materials.outsole}",
        "laces": "${translation.responseFormat.materials.laces}",
        "tongue": "${translation.responseFormat.materials.tongue}"
      },
      "cleaningRecommendations": [
        {
          "affectedPart": "${translation.responseFormat.cleaningRecommendations[0].affectedPart}",
          "recommendations": [
            "${translation.responseFormat.cleaningRecommendations[0].recommendations[0]}"
          ]
        }
      ],
      "generalCare": ["${translation.responseFormat.generalCare[0]}"]
    }
    
    # Notes
    - If the brand and model cannot be recognized, provide your best estimate or mark it as "unknown."
    - In cases where part of the material cannot be clearly identified, use "unspecified" or "possibly [type]" for transparency.
    - Be as specific as possible, but avoid guessing if the information is not recognizable.
    - Please format the response as JSON with the appropriate details based on the shoe in the image.
    `;

    if (brand) {
      prompt += ` The user has provided the brand: "${brand}".`;
    }

    if (problemDescription) {
      prompt += ` The user has described the following issue: "${problemDescription}".`;
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
                detail: "high",
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

    console.log("API Response received");

    // Parse the response
    const shoeDetails = JSON.parse(response.choices[0].message.content);

    // Find relevant products
    const recommendedProducts = findRelevantProducts(shoeDetails);

    // Add product recommendations to the response
    shoeDetails.recommendedProducts = recommendedProducts;

    // Send the formatted response back to the client
    res.json(shoeDetails);
  } catch (error) {
    console.error("Error processing image:", error);
    res.status(500).send("Error processing image");
  }
});

// Check image quality
async function checkImageQuality(base64Image) {
  try {
    // Convert base64 to buffer
    const buffer = Buffer.from(base64Image, "base64");

    // Use OpenAI to check image quality
    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content:
            "You are an image quality analyzer. Assess if the provided image is suitable for shoe recognition. Check for issues like: too dark, too bright/overexposed, blurry, or too low resolution. If there are issues, explain what's wrong. If the image is good quality, respond with 'PASS'.",
        },
        {
          role: "user",
          content: [
            {
              type: "image_url",
              image_url: {
                url: `data:image/jpeg;base64,${base64Image}`,
                detail: "low",
              },
            },
          ],
        },
      ],
      temperature: 0.5,
      max_tokens: 100,
    });

    const result = response.choices[0].message.content.trim();

    // If the response is "PASS", the image is good quality
    if (result === "PASS") {
      return null;
    }

    // Otherwise, return the quality issue
    return result;
  } catch (error) {
    console.error("Error checking image quality:", error);
    return null; // Continue with analysis if quality check fails
  }
}

// Start the Express server
app.listen(port, () => {
  console.log(`Server running on port ${port}`);

  // Load products database
  loadProductsDatabase();
});
