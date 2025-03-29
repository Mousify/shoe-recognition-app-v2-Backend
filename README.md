# AI Shoe Assistant

A modern web application that uses AI to analyze shoe images and provide cleaning and care recommendations.

## Project Structure

The project is split into two main parts:

### Frontend

Located in the `frontend` folder, this contains:

- `index.html` - The main HTML structure
- `style.css` - CSS styling for the application
- `script.js` - JavaScript for handling user interactions and API calls
- `products.json` - Sample product data for recommendations

### Backend

Located in the `backend` folder, this contains:

- `server.js` - Express server that handles API requests and communicates with OpenAI
- `products_export.csv` - CSV file containing product data for recommendations

## Features

1. **Real-Time Feedback & Progress Indicators**
   - Progress bar shows analysis status
   - Status messages keep users informed

2. **Enhanced Image Uploading Experience**
   - Drag-and-drop interface
   - Image preview and editing (rotate, zoom)

3. **Robust Error Handling & Validation**
   - Input validation for images
   - User-friendly error messages

4. **Interactive & Detailed Results Display**
   - Organized information in collapsible panels
   - Clear presentation of shoe details and recommendations

5. **Explanatory Tooltips and Help Sections**
   - Contextual tooltips for technical terms
   - Comprehensive help/FAQ section

6. **Multi-Language Support**
   - Language selection via dropdown
   - Dynamic translation of UI and AI prompts

7. **Product Suggestion Integration**
   - Relevant product recommendations
   - Visual product cards with details

8. **User-Provided Brand and Additional Shoe Details**
   - Optional brand input field
   - Flexible request parameters

9. **Photo Quality Analysis**
   - Preliminary quality check for uploaded images
   - Immediate feedback on image issues

10. **Responsive and Adaptive UI**
    - Mobile-first design
    - Works on all device sizes

11. **Result Management & Sharing Options**
    - Export results as PDF
    - Social sharing capabilities

12. **Accessibility Enhancements**
    - Screen reader compatibility
    - Keyboard navigation support

## Setup Instructions

### Frontend

1. Upload all files from the `frontend` folder to your web hosting service
2. Update the `backendURL` in `script.js` to point to your backend server

### Backend

1. Upload all files from the `backend` folder to your server (e.g., Render)
2. Install dependencies: `npm install express openai cors csv-parser dotenv`
3. Create a `.env` file with your OpenAI API key: `OPENAI_API_KEY=your_api_key_here`
4. Start the server: `node server.js`

## Technologies Used

- HTML, CSS, JavaScript (vanilla, no frameworks)
- Express.js for the backend
- OpenAI API for image analysis
- CSV parsing for product database

