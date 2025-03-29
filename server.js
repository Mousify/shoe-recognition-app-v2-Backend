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

// Update the loadProductsDatabase function
function loadProductsDatabase() {
  try {
    const csvFilePath = path.join(__dirname, "products_export.csv");

    // Check if file exists
    if (!fs.existsSync(csvFilePath)) {
      console.log(
        "Products CSV file not found. Using empty products database."
      );
      productsDatabase = [];
      return;
    }

    const results = [];

    fs.createReadStream(csvFilePath)
      .pipe(csv())
      .on("data", (data) => results.push(data))
      .on("end", () => {
        productsDatabase = results;
        console.log(`Loaded ${results.length} products into database`);
      })
      .on("error", (error) => {
        console.error("Error loading products database:", error);
        productsDatabase = [];
      });
  } catch (error) {
    console.error("Error in loadProductsDatabase:", error);
    productsDatabase = [];
  }
}

// Update the findRelevantProducts function
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
      if (
        material &&
        material.toLowerCase() !== "unknown" &&
        material.toLowerCase() !== "unspecified"
      ) {
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

      // Add recommendations as keywords (they often contain material types)
      rec.recommendations.forEach((recommendation) => {
        const words = recommendation.toLowerCase().split(" ");
        // Filter out common words
        const filteredWords = words.filter(
          (word) =>
            word.length > 3 &&
            ![
              "with",
              "and",
              "the",
              "for",
              "your",
              "that",
              "this",
              "then",
              "use",
            ].includes(word)
        );
        keywords.push(...filteredWords);
      });
    });
  }

  console.log("Keywords extracted:", keywords);

  // Score each product based on keyword matches
  const scoredProducts = productsDatabase.map((product) => {
    // Combine relevant product fields for matching
    const productText =
      `${product.Title} ${product["Body (HTML)"]} ${product.Tags} ${product.Vendor}`.toLowerCase();

    // Calculate match score
    let score = 0;
    keywords.forEach((keyword) => {
      if (productText.includes(keyword)) {
        // Increase score based on where the keyword is found
        if (product.Title.toLowerCase().includes(keyword)) {
          score += 3; // Higher weight for title matches
        } else if (
          product.Tags &&
          product.Tags.toLowerCase().includes(keyword)
        ) {
          score += 2; // Medium weight for tag matches
        } else {
          score += 1; // Lower weight for description matches
        }
      }
    });

    return { product, score };
  });

  // Sort by score (highest first) and take top 6
  const topProducts = scoredProducts
    .filter((item) => item.score > 0) // Only include products with matches
    .sort((a, b) => b.score - a.score)
    .slice(0, 6)
    .map((item) => ({
      id: item.product.Handle,
      title: item.product.Title,
      price: item.product["Variant Price"]
        ? `$${item.product["Variant Price"]}`
        : "Price not available",
      image:
        item.product["Image Src"] ||
        "https://via.placeholder.com/200x150?text=No+Image",
      vendor: item.product.Vendor,
      url: `https://example.com/products/${item.product.Handle}`,
    }));

  console.log(`Found ${topProducts.length} relevant products`);
  return topProducts;
}

// Update the translations in the backend
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
  ru: {
    systemPrompt:
      "Вы помощник интернет-магазина обуви, обученный определять модели обуви, материалы и предоставлять рекомендации по чистке.",
    responseFormat: {
      brandAndModel: "Бренд и название модели обуви",
      materials: {
        upper: "Материал верха",
        lining: "Материал подкладки",
        insole: "Материал стельки",
        outsole: "Материал подошвы",
        laces: "Материал шнурков",
        tongue: "Материал язычка",
      },
      cleaningRecommendations: [
        {
          affectedPart: "Поврежденная часть обуви",
          recommendations: ["Список рекомендаций по чистке"],
        },
      ],
      generalCare: ["Общие советы по уходу за обувью"],
    },
  },
  lt: {
    systemPrompt:
      "Jūs esate batų elektroninės parduotuvės asistentas, apmokytas atpažinti batų modelius, medžiagas ir teikti valymo rekomendacijas.",
    responseFormat: {
      brandAndModel: "Batų prekės ženklas ir modelio pavadinimas",
      materials: {
        upper: "Viršutinės dalies medžiaga",
        lining: "Pamušalo medžiaga",
        insole: "Vidpadžio medžiaga",
        outsole: "Pado medžiaga",
        laces: "Raištelių medžiaga",
        tongue: "Liežuvėlio medžiaga",
      },
      cleaningRecommendations: [
        {
          affectedPart: "Paveikta batų dalis",
          recommendations: ["Valymo rekomendacijų sąrašas"],
        },
      ],
      generalCare: ["Bendri batų priežiūros patarimai"],
    },
  },
};

// Update the checkImageQuality function in the backend
async function checkImageQuality(base64Image) {
  try {
    // Use OpenAI to check image quality
    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content:
            "You are an image quality analyzer. Assess if the provided image is suitable for shoe recognition. Check for issues like: too dark, too bright/overexposed, blurry, or too low resolution. If there are issues, explain what's wrong in a brief, user-friendly message. If the image is good quality, respond with 'PASS'.",
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

// Update the analyze-shoe endpoint to include quality check
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
      return res
        .status(400)
        .json({ error: "missing_image", message: "No image provided" });
    }

    // Check image quality
    const imageQualityIssue = await checkImageQuality(base64Image);
    if (imageQualityIssue) {
      return res
        .status(200)
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
        "laces": "Material of the laces",
        "tongue": "Material of the tongue"
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
    res
      .status(500)
      .json({ error: "processing_error", message: "Error processing image" });
  }
});

// Start the Express server
app.listen(port, () => {
  console.log(`Server running on port ${port}`);

  // Load products database
  loadProductsDatabase();
});
