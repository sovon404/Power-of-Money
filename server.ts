import express, { Request, Response } from 'express';
import { createServer as createViteServer } from 'vite';
import { GoogleGenAI, Type } from '@google/genai';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config();

const app = express();
const PORT = parseInt(process.env.PORT || '3000', 10);

app.use(express.json({ limit: '20mb' }));

// Shared server-side Gemini AI client
const geminiApiKey = process.env.GEMINI_API_KEY;
let aiClient: GoogleGenAI | null = null;

if (geminiApiKey) {
  aiClient = new GoogleGenAI({
    apiKey: geminiApiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

// ==========================================
// AI Assistant & Receipt Scanning Endpoints
// ==========================================

// 1. Receipt OCR & Transaction Extraction
app.post('/api/gemini/analyze-receipt', async (req: Request, res: Response): Promise<void> => {
  try {
    if (!aiClient) {
      res.status(503).json({
        error: 'Gemini API key is not configured on the server. Please check the Secrets panel.',
      });
      return;
    }

    const { imageBase64, mimeType = 'image/jpeg', availableCategories = [] } = req.body;

    if (!imageBase64) {
      res.status(400).json({ error: 'Missing imageBase64 data in request body.' });
      return;
    }

    // Strip data URL header if present
    const cleanBase64 = imageBase64.replace(/^data:image\/[a-z]+;base64,/, '');

    const categoryList = availableCategories.length > 0 
      ? availableCategories.join(', ')
      : 'Personal (Food), Electricity (Home), Wifi (Home), Personal (Transport), Mess Bill, Personal (Tech), Medical (Family)';

    const prompt = `Analyze this financial receipt or bill image.
Extract the merchant/vendor name, receipt date (in YYYY-MM-DD format, or today's date if not clearly visible), currency (default to BDT if Bangladeshi receipt or symbol ৳ is found, or USD if dollar), total paid amount (exact numeric value), suggested category from the following available workspace categories: [${categoryList}], payment method notes (e.g. Cash, bKash, Card), and line items if legible.

Return structured JSON.`;

    const response = await aiClient.models.generateContent({
      model: 'gemini-3.8-flash',
      contents: {
        parts: [
          {
            inlineData: {
              mimeType,
              data: cleanBase64,
            },
          },
          { text: prompt },
        ],
      },
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            merchant: { type: Type.STRING, description: 'Store, vendor or utility bill provider name' },
            date: { type: Type.STRING, description: 'Receipt transaction date in YYYY-MM-DD' },
            amount: { type: Type.NUMBER, description: 'Total amount paid' },
            currency: { type: Type.STRING, description: 'Currency code, e.g. BDT' },
            categorySuggestion: { type: Type.STRING, description: 'Most fitting expense category' },
            paymentMethod: { type: Type.STRING, description: 'Detected payment method like Cash, Card, bKash, etc.' },
            summary: { type: Type.STRING, description: 'Short 1-line description of the purchase' },
            items: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  name: { type: Type.STRING },
                  price: { type: Type.NUMBER },
                },
              },
            },
          },
          required: ['merchant', 'amount', 'categorySuggestion'],
        },
      },
    });

    const parsed = JSON.parse(response.text || '{}');
    res.json({ success: true, data: parsed });
  } catch (error: any) {
    console.error('Receipt analysis error:', error);
    res.status(500).json({ error: error.message || 'Failed to analyze receipt' });
  }
});

// 2. Financial Insights & Health Advisory
app.post('/api/gemini/financial-insights', async (req: Request, res: Response): Promise<void> => {
  try {
    if (!aiClient) {
      res.status(503).json({
        error: 'Gemini API key is not configured on the server. Please check the Secrets panel.',
      });
      return;
    }

    const { summaryData, currency = 'BDT' } = req.body;

    const prompt = `You are the executive financial advisor for "Power of Money" application.
Analyze the following authorized financial summary for the workspace (currency: ${currency}):
${JSON.stringify(summaryData, null, 2)}

Provide:
1. Executive Health Assessment (short, objective, professional tone).
2. Key Risk Alerts (e.g. debt-to-income, upcoming card dues, overdue loans, high recurring outflow).
3. 3 Actionable Recommendations for optimization, savings growth, or recovery collections.
4. Cash Flow Optimization Strategy.

Do not recommend taking unnecessary high-risk loans. All numbers should reference ${currency}. Keep it clear, concise, and structured.`;

    const response = await aiClient.models.generateContent({
      model: 'gemini-3.8-flash',
      contents: prompt,
      config: {
        systemInstruction: 'You are an objective, professional financial planning advisor specializing in personal and family wealth management with double-entry rigor.',
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            healthScore: { type: Type.INTEGER, description: 'Overall financial health score 0-100' },
            assessmentSummary: { type: Type.STRING, description: 'Short summary of current standing' },
            keyRisks: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
              description: 'Observed financial risks or bottlenecks',
            },
            recommendations: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
              description: 'Actionable financial recommendations',
            },
            savingsOpportunity: { type: Type.STRING, description: 'Identified potential savings area' },
          },
          required: ['healthScore', 'assessmentSummary', 'recommendations'],
        },
      },
    });

    const parsed = JSON.parse(response.text || '{}');
    res.json({ success: true, data: parsed });
  } catch (error: any) {
    console.error('Financial insights error:', error);
    res.status(500).json({ error: error.message || 'Failed to generate financial insights' });
  }
});

// 3. Ask Financial Advisor
app.post('/api/gemini/ask-advisor', async (req: Request, res: Response): Promise<void> => {
  try {
    if (!aiClient) {
      res.status(503).json({
        error: 'Gemini API key is not configured on the server.',
      });
      return;
    }

    const { question, context } = req.body;

    if (!question) {
      res.status(400).json({ error: 'Question is required.' });
      return;
    }

    const systemInstruction = `You are the Power of Money Financial Advisor.
You assist the user by answering questions strictly based on their authorized financial data and accounting best practices.
Accounting Principles:
- Borrowed money is a liability, not income.
- Money lent is a receivable (asset), not an expense.
- Credit card payment reduces liability and cash, it is NOT an expense.
- Property valuation increases are unrealized capital gains, not cash income.
- Property recovery receipts reduce recovery balance/receivable.
- Always provide clear, practical numbers in BDT (৳) unless another currency is specified.`;

    const response = await aiClient.models.generateContent({
      model: 'gemini-3.8-flash',
      contents: `Context Data:\n${JSON.stringify(context, null, 2)}\n\nUser Question:\n${question}`,
      config: {
        systemInstruction,
      },
    });

    res.json({ success: true, answer: response.text });
  } catch (error: any) {
    console.error('Ask advisor error:', error);
    res.status(500).json({ error: error.message || 'Failed to consult financial advisor' });
  }
});

// ==========================================
// Vite Dev Server & Static Assets
// ==========================================
async function initServer() {
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        hmr: process.env.DISABLE_HMR !== 'true',
        watch: process.env.DISABLE_HMR === 'true' ? null : {},
      },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req: Request, res: Response) => {
      res.sendFile(path.resolve(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`[Power of Money] Full-stack server running on http://0.0.0.0:${PORT}`);
  });
}

initServer().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
