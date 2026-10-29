import axios from 'axios';
import logger from '../../utils/logger.js';

export async function generateCopy({ businessDescription, productOrService, offerDetails, targetAudience = 'All Customers', language = 'English', tone = 'Engaging & Urgent' }) {
  const provider = process.env.AI_PROVIDER || 'mock';

  // High quality templates for Hindi, Hinglish, and English
  if (provider === 'mock' || !process.env.OPENAI_API_KEY) {
    logger.info(`[AI:Mock] Generating promotional copy in ${language} with ${tone} tone`);

    if (language === 'Hindi') {
      return {
        provider: 'mock',
        language: 'Hindi',
        suggestedCopies: [
          {
            title: 'धमाका ऑफर (Urgent & Exciting)',
            header: 'विशेष त्यौहारी छूट सिर्फ आपके लिए! 🎉',
            body: `नमस्ते {{1}}, ${businessDescription || 'हमारी दुकान'} पर ${productOrService || 'शानदार प्रोडक्ट्स'} पर पाइए ${offerDetails || 'भारी छूट'}! सीमित समय के लिए उपलब्ध। कूपन कोड: FESTIVE30`,
            footer: 'अनसब्सक्राइब करने के लिए STOP भेजें',
            ctaText: 'अभी खरीदें'
          },
          {
            title: 'सीमित समय बचत (Friendly & Warm)',
            header: 'बधाई हो {{1}}! 🎁',
            body: `नमस्ते {{1}}, आपके पसंदीदा ${productOrService || 'सामान'} पर विशेष बचत का मौका। आज ही ऑर्डर करें और ${offerDetails || 'विशेष उपहार'} पाएं।`,
            footer: 'STOP लिखकर सदस्यता रद्द करें',
            ctaText: 'ऑर्डर करें'
          }
        ],
        variableSuggestions: {
          '{{1}}': 'Customer Name (e.g. Rahul Sharma)',
          '{{2}}': 'Discount Percentage (e.g. 30%)',
          '{{3}}': 'Coupon Code (e.g. FESTIVE30)'
        },
        complianceNote: 'All generated copies require WhatsApp Template approval with an opt-out footer.'
      };
    } else if (language === 'Hinglish') {
      return {
        provider: 'mock',
        language: 'Hinglish',
        suggestedCopies: [
          {
            title: 'Festive Dhamaka (Engaging Hinglish)',
            header: 'Khaas offer sirf aapke liye, {{1}}! 🎉',
            body: `Hello {{1}}, ${businessDescription || 'hamare store'} par ${productOrService || 'best items'} par mil raha hai ${offerDetails || 'flat 30% OFF'}! Offer sirf iss Sunday tak valid hai. Code use karein: FESTIVE30.`,
            footer: 'Reply STOP to opt out',
            ctaText: 'Shop Now'
          },
          {
            title: 'VIP Early Access (Exclusive & Urgent)',
            header: 'Exclusive Early Access! 🌟',
            body: `Hey {{1}}, VIP members ke liye ${productOrService || 'nayi collection'} par special access open ho chuka hai. Payein ${offerDetails || 'extra benefits'}. Check out karein!`,
            footer: 'Reply STOP to unsubscribe',
            ctaText: 'View Collection'
          }
        ],
        variableSuggestions: {
          '{{1}}': 'Customer Name (e.g. Ananya)',
          '{{2}}': 'Discount / Offer (e.g. Flat 30% off)',
          '{{3}}': 'Promo Code (e.g. FESTIVE30)'
        },
        complianceNote: 'All generated copies require WhatsApp Template approval with an opt-out footer.'
      };
    }

    // Default English
    return {
      provider: 'mock',
      language: 'English',
      suggestedCopies: [
        {
          title: 'High Converting Flash Sale',
          header: 'Exclusive Offer for {{1}} 🎉',
          body: `Hi {{1}}, get ready for our biggest sale at ${businessDescription || 'our store'}! Enjoy ${offerDetails || 'flat 30% off'} on all ${productOrService || 'featured collections'}. Use code {{2}} at checkout before Sunday.`,
          footer: 'Reply STOP to unsubscribe',
          ctaText: 'Claim Discount'
        },
        {
          title: 'VIP Loyalty Reward',
          header: 'A Special Gift For You, {{1}} 🌟',
          body: `Hello {{1}}, as a valued customer, you get early access to our ${productOrService || 'premium range'} with ${offerDetails || 'complimentary gifts'}. Don't miss out!`,
          footer: 'Reply STOP to unsubscribe',
          ctaText: 'Shop Now'
        }
      ],
      variableSuggestions: {
        '{{1}}': 'Customer Full Name',
        '{{2}}': 'Discount Coupon Code',
        '{{3}}': 'Expiry Date'
      },
      complianceNote: 'All generated copies require WhatsApp Template approval with an opt-out footer.'
    };
  }

  // OpenAI real integration if API key is provided
  try {
    const prompt = `You are a WhatsApp Marketing copywriter. Write 2 high-converting promotional message templates in ${language} with ${tone} tone for:
Business: ${businessDescription}
Product/Service: ${productOrService}
Offer: ${offerDetails}
Target: ${targetAudience}
Include WhatsApp placeholders like {{1}} for name, {{2}} for offer. Always append footer: "Reply STOP to unsubscribe". Return in JSON format.`;

    const response = await axios.post(
      'https://api.openai.com/v1/chat/completions',
      {
        model: 'gpt-4o-mini',
        messages: [{ role: 'user', content: prompt }],
        response_format: { type: 'json_object' }
      },
      {
        headers: { Authorization: `Bearer ${process.env.OPENAI_API_KEY}` }
      }
    );

    return JSON.parse(response.data.choices[0].message.content);
  } catch (error) {
    logger.error('[AI] OpenAI generation failed, falling back to built-in templates', error);
    return generateCopy({ businessDescription, productOrService, offerDetails, language, tone, targetAudience });
  }
}

export default {
  generateCopy
};
