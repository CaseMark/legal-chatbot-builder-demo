/**
 * Detects personally identifiable information (PII) in text
 */

const PII_PATTERNS = {
  ssn: /\b(?:\d{3}-?\d{2}-?\d{4}|\d{9})\b/g,
  phone: /\b(?:\+?1[-.\s]?)?(?:\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4})\b/g,
  email: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g,
  creditCard:
    /\b(?:4[0-9]{12}(?:[0-9]{3})?|5[1-5][0-9]{14}|3[47][0-9]{13}|3[0-9]{13}|6(?:011|5[0-9]{2})[0-9]{12})\b/g,
  driversLicense: /\b[A-Z]{1,2}[0-9]{6,8}\b/g,
  routingNumber: /\b[0-9]{9}\b/g,
  address:
    /\b\d+\s+[A-Za-z\s]+(?:Street|St|Avenue|Ave|Road|Rd|Drive|Dr|Lane|Ln|Boulevard|Blvd|Circle|Cir|Court|Ct|Way)\b/gi,
  dateOfBirth:
    /\b(?:0?[1-9]|1[0-2])[\/\-\.](0?[1-9]|[12][0-9]|3[01])[\/\-\.](?:19|20)\d{2}\b/g,
  medicalRecord:
    /\b(?:MRN|MR|Patient\s+ID|Patient\s+Number)[\s:]*[A-Z0-9]{6,}\b/gi,
  insurancePolicy: /\b(?:Policy|Pol)[\s#:]*[A-Z0-9]{8,}\b/gi,
};

const COMMON_NAMES = [
  "john",
  "jane",
  "michael",
  "sarah",
  "david",
  "jennifer",
  "robert",
  "lisa",
  "william",
  "mary",
  "james",
  "patricia",
  "richard",
  "linda",
  "thomas",
  "elizabeth",
  "christopher",
  "barbara",
  "daniel",
  "susan",
  "matthew",
  "jessica",
  "anthony",
  "betty",
  "smith",
  "johnson",
  "williams",
  "brown",
  "jones",
  "garcia",
  "miller",
  "davis",
  "rodriguez",
  "martinez",
  "hernandez",
  "lopez",
  "gonzalez",
  "wilson",
  "anderson",
  "thomas",
];

export interface PIIDetectionResult {
  hasPII: boolean;
  detectedTypes: string[];
  matches: Array<{
    type: string;
    match: string;
    position: number;
  }>;
  riskLevel: "low" | "medium" | "high";
}

export function detectPII(text: string): PIIDetectionResult {
  const result: PIIDetectionResult = {
    hasPII: false,
    detectedTypes: [],
    matches: [],
    riskLevel: "low",
  };

  const lowerText = text.toLowerCase();

  Object.entries(PII_PATTERNS).forEach(([type, pattern]) => {
    const matches = Array.from(text.matchAll(pattern));
    if (matches.length > 0) {
      result.hasPII = true;
      result.detectedTypes.push(type);
      matches.forEach((match) => {
        result.matches.push({
          type,
          match: match[0],
          position: match.index || 0,
        });
      });
    }
  });

  const words = lowerText.split(/\s+/);
  const potentialNames = words.filter(
    (word) =>
      word.length > 2 && COMMON_NAMES.includes(word) && /^[a-z]+$/.test(word)
  );

  if (potentialNames.length > 0) {
    result.hasPII = true;
    result.detectedTypes.push("name");
    potentialNames.forEach((name) => {
      const position = lowerText.indexOf(name);
      result.matches.push({
        type: "name",
        match: name,
        position,
      });
    });
  }

  const highRiskTypes = ["ssn", "creditCard", "driversLicense", "medicalRecord"];
  const mediumRiskTypes = [
    "phone",
    "email",
    "address",
    "dateOfBirth",
    "insurancePolicy",
  ];

  if (result.detectedTypes.some((type) => highRiskTypes.includes(type))) {
    result.riskLevel = "high";
  } else if (
    result.detectedTypes.some((type) => mediumRiskTypes.includes(type))
  ) {
    result.riskLevel = "medium";
  } else if (result.hasPII) {
    result.riskLevel = "medium";
  }

  return result;
}

export function isSafeForWebSearch(query: string): boolean {
  const piiResult = detectPII(query);
  return !piiResult.hasPII;
}

export function getPIIWarningMessage(piiResult: PIIDetectionResult): string {
  if (!piiResult.hasPII) return "";

  const types = piiResult.detectedTypes;
  let message =
    "For your privacy, web search has been disabled because your query contains ";

  if (types.includes("ssn")) message += "social security numbers, ";
  if (types.includes("phone")) message += "phone numbers, ";
  if (types.includes("email")) message += "email addresses, ";
  if (types.includes("creditCard")) message += "credit card numbers, ";
  if (types.includes("address")) message += "addresses, ";
  if (types.includes("name")) message += "potential names, ";
  if (types.includes("dateOfBirth")) message += "dates of birth, ";
  if (types.includes("medicalRecord")) message += "medical record numbers, ";
  if (types.includes("insurancePolicy")) message += "insurance policy numbers, ";

  message = message.replace(/, $/, "");
  message +=
    ". Please try rephrasing your question without personal information.";

  return message;
}
