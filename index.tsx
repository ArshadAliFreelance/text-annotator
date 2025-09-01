
import React, { useState, useRef, useCallback, useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import { GoogleGenAI, Type } from "@google/genai";

type TextAnnotationType = 'ner' | 'sentiment' | 'pos';
interface NerAnnotation { type: string; text: string; startIndex: number; endIndex: number; }
interface SentimentAnnotation { sentiment: 'Positive' | 'Negative' | 'Neutral'; confidence: number; }
interface PosAnnotation { token: string; tag: string; }

const USER_MANUAL_CONTENT = `# Text Annotator User Manual

Welcome to Text Annotator! This application is designed to help you efficiently analyze and manage text files using AI.

This manual will guide you through all the features, from uploading your first file to exporting your final annotations.

---

## 1. The Interface

The application is divided into two main panels:
- **The Text Panel (Left):** This is where you upload your file or paste your text. Once loaded, it will display your text content with any applicable highlights.
- **The Analysis Panel (Right):** This is your main workspace. It's where the AI-generated analysis appears and where you can export your final work.

---

## 2. Getting Started

### 2.1. Uploading a File
- **Drag & Drop:** Drag your text file (.txt, .csv, .tsv, .html, .xml) or a PDF file and drop it into the upload area on the left.
- **File Selector:** Click the upload area to open your file browser and select a file.

### 2.2. Pasting Text
- You can also paste text directly into the text box in the Text Panel and click "Analyze Text" to begin.

---

## 3. Text Annotation

After uploading a text-based file or pasting text, you can perform different types of analysis.
- **PDF Processing:** PDFs will be processed with Optical Character Recognition (OCR) to automatically extract text.
- **Selecting an Analysis Type:** Use the dropdown in the Analysis Panel to choose an analysis:
    - **Named Entity Recognition (NER):** Identifies and highlights people, places, organizations, etc., in your text.
    - **Sentiment Analysis:** Determines if the overall tone of the text is positive, negative, or neutral.
    - **Part-of-Speech (POS) Tagging:** Categorizes each word by its grammatical type (noun, verb, etc.).
- **Generating Annotations:** Click the **Analyze** button to have the AI process your text. The results will appear in the right-hand panel.

---

## 4. Workspace Tools

### 4.1. Exporting Your Work
Click the **Download** button to see a list of available export formats.
- **Available Formats:** JSON, JSONL, CSV, and XML. For Named Entity Recognition (NER), an additional BIO Tagging format is also available.

### 4.2. Clearing the Workspace
- The **Clear** button removes the current text and all its analysis, allowing you to start fresh.

---

## 5. Privacy and Data Collection Disclaimer
- **Data Processing:** Files and text you provide are sent to the Google Gemini API for processing.
- **Data Storage:** We do not store your files or text on our servers after the analysis.
- **Sensitive Information:** We strongly advise against uploading any files or text containing sensitive personal, financial, or confidential information.
- **Acknowledgement:** By using this application, you acknowledge and agree to this data processing arrangement.

Thank you for using Text Annotator!
`;

const App = () => {
    const [textContent, setTextContent] = useState('');
    const [fileName, setFileName] = useState('');
    const [isTextLoaded, setIsTextLoaded] = useState(false);
    const [textAnnotationType, setTextAnnotationType] = useState<TextAnnotationType>('ner');
    const [textAnalysisResult, setTextAnalysisResult] = useState<any>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState('');
    const [isDownloadDropdownOpen, setIsDownloadDropdownOpen] = useState(false);
    const [isManualOpen, setIsManualOpen] = useState(false);

    const downloadDropdownRef = useRef<HTMLDivElement>(null);
    const pastedTextRef = useRef<HTMLTextAreaElement>(null);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (downloadDropdownRef.current && !downloadDropdownRef.current.contains(event.target as Node)) {
                setIsDownloadDropdownOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, []);

    const fileToBase64 = (file: File): Promise<string> => new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = () => {
            if (typeof reader.result === 'string') {
                resolve(reader.result.split(',')[1]);
            } else {
                reject(new Error('Failed to read file as base64 string.'));
            }
        };
        reader.onerror = error => reject(error);
    });
    
    const fileToText = (file: File): Promise<string> => new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsText(file);
        reader.onload = () => {
            if (typeof reader.result === 'string') {
                resolve(reader.result);
            } else {
                reject(new Error('Failed to read file as text.'));
            }
        };
        reader.onerror = error => reject(error);
    });

    const handleFileDrop = useCallback((event: React.DragEvent<HTMLDivElement>) => {
        event.preventDefault();
        const file = event.dataTransfer.files[0];
        if (file) {
            handleFile(file);
        }
    }, []);
    
    const handleFileSelect = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (file) {
            handleFile(file);
        }
    }, []);
    
    const resetState = () => {
        setIsTextLoaded(false);
        setTextContent('');
        setFileName('');
        setError('');
        setTextAnalysisResult(null);
        setTextAnnotationType('ner');
        if (pastedTextRef.current) pastedTextRef.current.value = '';
    }

    const extractTextFromPdf = async (file: File) => {
        setIsLoading(true);
        setError('');
        try {
            const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
            const base64Data = await fileToBase64(file);

            const pdfPart = {
                inlineData: {
                    mimeType: 'application/pdf',
                    data: base64Data,
                },
            };

            const prompt = "Perform OCR on this PDF document and extract all text content. Combine the text from all pages into a single block of text, preserving paragraph structure as best as possible.";

            const response = await ai.models.generateContent({
                model: 'gemini-2.5-flash',
                contents: { parts: [pdfPart, { text: prompt }] },
            });

            setTextContent(response.text);
            setFileName(file.name);
            setIsTextLoaded(true);

        } catch (err) {
            console.error("PDF Extraction Error:", err);
            setError('Failed to extract text from PDF. The file might be corrupted or an API error occurred.');
        } finally {
            setIsLoading(false);
        }
    };


    const handleFile = async (file: File) => {
        resetState();
        
        const textMimeTypes = ['text/plain', 'text/csv', 'text/tab-separated-values', 'text/html', 'text/xml', 'application/xml'];
        const textExtensions = ['txt', 'csv', 'tsv', 'html', 'xml'];
        const fileExtension = file.name.split('.').pop()?.toLowerCase() || '';

        if (file.type === 'application/pdf') {
            await extractTextFromPdf(file);
        } else if (textMimeTypes.includes(file.type) || textExtensions.includes(fileExtension)) {
            const text = await fileToText(file);
            setTextContent(text);
            setFileName(file.name);
            setIsTextLoaded(true);
        } else {
            setError('Please upload a valid text file (.txt, .csv, .tsv, .html, .xml, .pdf).');
        }
    }
    
    const handleTextSubmit = () => {
        const text = pastedTextRef.current?.value;
        if (text && text.trim()) {
            resetState();
            setTextContent(text);
            setFileName('pasted_text');
            setIsTextLoaded(true);
        } else {
            setError("Please paste some text before analyzing.");
        }
    }

    const generateTextAnnotations = async () => {
        if (!textContent) {
            setError('No text to analyze.');
            return;
        }
        setIsLoading(true);
        setError('');
        setTextAnalysisResult(null);

        try {
            const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
            let prompt: string;
            let responseSchema: any;

            switch (textAnnotationType) {
                case 'ner':
                    prompt = "Extract all named entities from the following text. For each entity, provide its text, type (e.g., PERSON, LOCATION, ORGANIZATION, DATE, MISC), and its starting character index in the original text.";
                    responseSchema = {
                        type: Type.ARRAY,
                        items: {
                            type: Type.OBJECT,
                            properties: {
                                text: { type: Type.STRING },
                                type: { type: Type.STRING },
                                startIndex: { type: Type.INTEGER },
                            },
                            required: ["text", "type", "startIndex"]
                        }
                    };
                    break;
                case 'sentiment':
                    prompt = "Analyze the sentiment of the following text. Classify it as 'Positive', 'Negative', or 'Neutral'. Also provide a confidence score from 0 to 1.";
                    responseSchema = {
                        type: Type.OBJECT,
                        properties: {
                            sentiment: { type: Type.STRING },
                            confidence: { type: Type.NUMBER }
                        }
                    };
                    break;
                case 'pos':
                    prompt = "Perform Part-of-Speech tagging on the following text. Provide a list of tokens and their corresponding POS tag (using the Universal Dependencies tagset, e.g., NOUN, VERB, ADJ).";
                    responseSchema = {
                        type: Type.ARRAY,
                        items: {
                            type: Type.OBJECT,
                            properties: {
                                token: { type: Type.STRING },
                                tag: { type: Type.STRING }
                            },
                            required: ["token", "tag"]
                        }
                    };
                    break;
            }

            const fullPrompt = `${prompt}\n\nTEXT: """${textContent}"""`;
            const response = await ai.models.generateContent({
                model: 'gemini-2.5-flash',
                contents: fullPrompt,
                config: {
                    responseMimeType: "application/json",
                    responseSchema: responseSchema,
                }
            });

            const result = JSON.parse(response.text);
            
            if (textAnnotationType === 'ner') {
                // Calculate endIndex for easier highlighting
                const processedResult = result.map((entity: Omit<NerAnnotation, 'endIndex'>) => ({
                    ...entity,
                    endIndex: entity.startIndex + entity.text.length
                })).sort((a: NerAnnotation, b: NerAnnotation) => a.startIndex - b.startIndex);
                setTextAnalysisResult(processedResult);
            } else {
                setTextAnalysisResult(result);
            }

        } catch (err) {
            console.error(err);
            let friendlyError = 'Failed to generate text annotations. Please check the console for details.';
            if (err && typeof err === 'object' && 'message' in err && typeof err.message === 'string') {
                const errorMessage = err.message.toLowerCase();
                if (errorMessage.includes('unauthenticated') || errorMessage.includes('401') || errorMessage.includes('api key not valid')) {
                    friendlyError = 'Authentication Error: The API key is invalid or missing. Please ensure it is correctly configured in your environment settings.';
                } else if (errorMessage.includes('quota')) {
                    friendlyError = 'Quota Exceeded: You have exceeded your API usage limit. Please check your Google AI Platform console.';
                }
            }
            setError(friendlyError);
        } finally {
            setIsLoading(false);
        }
    };

    const getBaseFilename = () => {
        if (fileName) return fileName.split('.').slice(0, -1).join('.') || fileName;
        return 'annotations';
    }

    const downloadFile = (data: string, filename: string, type: string) => {
        const blob = new Blob([data], { type });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
        setIsDownloadDropdownOpen(false);
    };

    const escapeCsvCell = (cell: any) => {
        const str = String(cell);
        if (str.includes(',') || str.includes('"') || str.includes('\n')) {
            return `"${str.replace(/"/g, '""')}"`;
        }
        return str;
    };

    const escapeXml = (str: string | number) => String(str).replace(/[<>&'"]/g, (c) => {
        switch(c) {
            case '<': return '&lt;';
            case '>': return '&gt;';
            case '&': return '&amp;';
            case '\'': return '&apos;';
            case '"': return '&quot;';
            default: return c;
        }
    });

    const downloadJson = () => {
        const dataToExport = {
            sourceText: textContent,
            analysisType: textAnnotationType,
            results: textAnalysisResult
        };
        const dataStr = JSON.stringify(dataToExport, null, 2);
        downloadFile(dataStr, `${getBaseFilename()}_annotations.json`, 'application/json');
    };

    const downloadJsonl = () => {
        if (!textAnalysisResult) return;
        let dataStr = '';
        if ((textAnnotationType === 'ner' || textAnnotationType === 'pos') && Array.isArray(textAnalysisResult)) {
            dataStr = textAnalysisResult.map(item => JSON.stringify(item)).join('\n');
        } else {
            dataStr = JSON.stringify(textAnalysisResult);
        }
        downloadFile(dataStr, `${getBaseFilename()}_${textAnnotationType}.jsonl`, 'application/jsonl');
    };

    const downloadTextCsv = () => {
        if (!textAnalysisResult) return;
        
        let csvContent = '';
        if (textAnnotationType === 'ner' && Array.isArray(textAnalysisResult)) {
            const headers: (keyof NerAnnotation)[] = ['text', 'type', 'startIndex', 'endIndex'];
            csvContent += headers.join(',') + '\n';
            csvContent += (textAnalysisResult as NerAnnotation[]).map(row => 
                headers.map(header => escapeCsvCell(row[header])).join(',')
            ).join('\n');
        } else if (textAnnotationType === 'pos' && Array.isArray(textAnalysisResult)) {
            const headers: (keyof PosAnnotation)[] = ['token', 'tag'];
            csvContent += headers.join(',') + '\n';
            csvContent += (textAnalysisResult as PosAnnotation[]).map(row => 
                headers.map(header => escapeCsvCell(row[header])).join(',')
            ).join('\n');
        } else if (textAnnotationType === 'sentiment') {
            const headers: (keyof SentimentAnnotation)[] = ['sentiment', 'confidence'];
            csvContent += headers.join(',') + '\n';
            csvContent += headers.map(header => escapeCsvCell((textAnalysisResult as SentimentAnnotation)[header])).join(',');
        }

        downloadFile(csvContent, `${getBaseFilename()}_${textAnnotationType}.csv`, 'text/csv');
    };

    const downloadTextXml = () => {
        if (!textAnalysisResult) return;
        let xmlContent = '<?xml version="1.0" encoding="UTF-8"?>\n';
        xmlContent += `<results analysisType="${textAnnotationType}">\n`;

        if (textAnnotationType === 'ner' && Array.isArray(textAnalysisResult)) {
            xmlContent += '  <entities>\n';
            (textAnalysisResult as NerAnnotation[]).forEach(e => {
                xmlContent += `    <entity type="${escapeXml(e.type)}">\n`;
                xmlContent += `      <text>${escapeXml(e.text)}</text>\n`;
                xmlContent += `      <startIndex>${e.startIndex}</startIndex>\n`;
                xmlContent += `      <endIndex>${e.endIndex}</endIndex>\n`;
                xmlContent += `    </entity>\n`;
            });
            xmlContent += '  </entities>\n';
        } else if (textAnnotationType === 'pos' && Array.isArray(textAnalysisResult)) {
            xmlContent += '  <tokens>\n';
            (textAnalysisResult as PosAnnotation[]).forEach(p => {
                xmlContent += `    <token tag="${escapeXml(p.tag)}">\n`;
                xmlContent += `      <text>${escapeXml(p.token)}</text>\n`;
                xmlContent += `    </token>\n`;
            });
            xmlContent += '  </tokens>\n';
        } else if (textAnnotationType === 'sentiment') {
            const res = textAnalysisResult as SentimentAnnotation;
            xmlContent += `  <sentiment>${escapeXml(res.sentiment)}</sentiment>\n`;
            xmlContent += `  <confidence>${res.confidence}</confidence>\n`;
        }

        xmlContent += '</results>';
        downloadFile(xmlContent, `${getBaseFilename()}_${textAnnotationType}.xml`, 'application/xml');
    };
    
    const downloadBio = () => {
        if (textAnnotationType !== 'ner' || !Array.isArray(textAnalysisResult) || !textContent) return;

        // Tokenize while preserving index
        const tokens: { text: string; start: number; end: number }[] = [];
        const regex = /[\w']+|[^\s\w']/g;
        let match;
        while ((match = regex.exec(textContent)) !== null) {
            tokens.push({
                text: match[0],
                start: match.index,
                end: match.index + match[0].length,
            });
        }

        const tags = Array(tokens.length).fill('O');
        const sortedEntities = [...(textAnalysisResult as NerAnnotation[])].sort((a, b) => a.startIndex - b.startIndex);

        sortedEntities.forEach(entity => {
            let isFirstTokenInEntity = true;
            for (let i = 0; i < tokens.length; i++) {
                const token = tokens[i];
                if (token.start >= entity.startIndex && token.end <= entity.endIndex) {
                    if (tags[i] === 'O') {
                        tags[i] = isFirstTokenInEntity ? `B-${entity.type}` : `I-${entity.type}`;
                        isFirstTokenInEntity = false;
                    }
                }
            }
        });
        
        const bioContent = tokens.map((token, index) => `${token.text}\t${tags[index]}`).join('\n');
        downloadFile(bioContent, `${getBaseFilename()}_ner.bio.txt`, 'text/plain');
    };

    const FormattedManual = ({ content }: { content: string }) => {
        const lines = content.split('\n');
        const elements: JSX.Element[] = [];
        let listItems: string[] = [];

        const processLine = (line: string) => {
            let processedLine = line.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
            processedLine = processedLine.replace(/`(.*?)`/g, '<code>$1</code>');
            return processedLine;
        };
    
        const flushList = () => {
            if (listItems.length > 0) {
                elements.push(
                    <ul key={`ul-${elements.length}`}>
                        {listItems.map((item, index) => (
                            <li key={index} dangerouslySetInnerHTML={{ __html: processLine(item) }}></li>
                        ))}
                    </ul>
                );
                listItems = [];
            }
        };
    
        lines.forEach((line, index) => {
            const trimmedLine = line.trim();
            if (trimmedLine.startsWith('# ')) { flushList(); elements.push(<h1 key={index} dangerouslySetInnerHTML={{ __html: processLine(trimmedLine.substring(2)) }} />); }
            else if (trimmedLine.startsWith('## ')) { flushList(); elements.push(<h2 key={index} dangerouslySetInnerHTML={{ __html: processLine(trimmedLine.substring(3)) }} />); }
            else if (trimmedLine.startsWith('### ')) { flushList(); elements.push(<h3 key={index} dangerouslySetInnerHTML={{ __html: processLine(trimmedLine.substring(4)) }} />); }
            else if (trimmedLine === '---') { flushList(); elements.push(<hr key={index} />); }
            else if (trimmedLine.startsWith('* ') || trimmedLine.startsWith('- ')) { listItems.push(trimmedLine.substring(2).trim()); }
            else if (trimmedLine !== '') { flushList(); elements.push(<p key={index} dangerouslySetInnerHTML={{ __html: processLine(trimmedLine) }}></p>); }
            else { flushList(); }
        });
        flushList();
        return <>{elements}</>;
    };

    const ManualModal = () => (
        <div className="modal-overlay" onClick={() => setIsManualOpen(false)}>
            <div className="modal-content" onClick={(e) => e.stopPropagation()}>
                <div className="modal-header">
                    <h2>User Manual</h2>
                    <button className="modal-close-btn" onClick={() => setIsManualOpen(false)} aria-label="Close user manual">{'×'}</button>
                </div>
                <div className="modal-body">
                    <FormattedManual content={USER_MANUAL_CONTENT} />
                </div>
                <div className="modal-footer">
                    <p>© 2025 Arshad Ali | All rights reserved.</p>
                    <p className="footer-disclaimer">No part of this app may be reproduced, distributed, or transmitted in any form without the express written permission of the developer.</p>
                </div>
            </div>
        </div>
    );
    
    const TextRenderer = ({ text, nerAnnotations }: { text: string, nerAnnotations: NerAnnotation[] }) => {
        if (!nerAnnotations || nerAnnotations.length === 0) {
            return <p>{text}</p>;
        }

        let lastIndex = 0;
        const parts = [];

        nerAnnotations.forEach((ann, i) => {
            if (ann.startIndex > lastIndex) {
                parts.push(<span key={`text-${lastIndex}`}>{text.substring(lastIndex, ann.startIndex)}</span>);
            }
            parts.push(
                <span key={`ann-${i}`} className={`entity-highlight entity-${ann.type.toLowerCase()}`} title={ann.type}>
                    {text.substring(ann.startIndex, ann.endIndex)}
                </span>
            );
            lastIndex = ann.endIndex;
        });

        if (lastIndex < text.length) {
            parts.push(<span key={`text-${lastIndex}`}>{text.substring(lastIndex)}</span>);
        }

        return <div className="text-display-area">{parts}</div>;
    };
    
    const renderTextAnalysisResults = () => {
        if (!textAnalysisResult) return <div className="placeholder">Click "Analyze" to generate annotations.</div>;

        switch (textAnnotationType) {
            case 'ner':
                const groupedEntities = (textAnalysisResult as NerAnnotation[]).reduce((acc, entity) => {
                    acc[entity.type] = [...(acc[entity.type] || []), entity.text];
                    return acc;
                }, {} as Record<string, string[]>);

                return Object.entries(groupedEntities).map(([type, texts]) => (
                    <div key={type} className="text-analysis-group">
                        <h3 className={`entity-title entity-${type.toLowerCase()}`}>{type}</h3>
                        <div className="tags-container">
                            {[...new Set(texts)].map(text => <span key={text} className="tag-pill text-entity-tag">{text}</span>)}
                        </div>
                    </div>
                ));
            case 'sentiment':
                const { sentiment, confidence } = textAnalysisResult as SentimentAnnotation;
                return (
                     <div className={`sentiment-result sentiment-${sentiment?.toLowerCase()}`}>
                        <div className="sentiment-label">{sentiment}</div>
                        <div className="sentiment-confidence">Confidence: {(confidence * 100).toFixed(1)}%</div>
                    </div>
                );
            case 'pos':
                return (
                    <div className="pos-results-list">
                        {(textAnalysisResult as PosAnnotation[]).map(({ token, tag }, index) => (
                             <div key={index} className="pos-item">
                                <span className="pos-token">{token}</span>
                                <span className="pos-tag">{tag}</span>
                            </div>
                        ))}
                    </div>
                );
            default:
                return null;
        }
    };


    return (
        <div id="app-container">
            <header>
                <h1>Text Annotator</h1>
                <button
                    className="manual-btn"
                    onClick={() => setIsManualOpen(true)}
                    aria-label="Open user manual"
                    title="Open user manual"
                >
                    User Manual
                </button>
            </header>
            <main>
                <div className="media-panel">
                    {!isTextLoaded ? (
                        <div 
                            className="drop-zone-wrapper"
                            onDrop={handleFileDrop}
                            onDragOver={(e) => e.preventDefault()}
                        >
                            <div 
                                className="drop-zone"
                                onClick={() => document.getElementById('file-input')?.click()}
                            >
                                <p>Drop your text/pdf file here or click to select</p>
                                <input type="file" id="file-input" accept=".txt,.csv,.tsv,.html,.xml,.pdf" onChange={handleFileSelect} hidden />
                            </div>
                            <div className="text-input-section">
                                <textarea ref={pastedTextRef} placeholder="Or paste text directly here..." onClick={(e) => e.stopPropagation()}></textarea>
                                <button className="analyze-text-btn" onClick={handleTextSubmit}>Analyze Text</button>
                            </div>
                        </div>
                    ) : (
                        <TextRenderer text={textContent} nerAnnotations={textAnnotationType === 'ner' ? textAnalysisResult : []} />
                    )}
                </div>
                <div className="annotations-panel">
                    {isLoading && <div className="loading-overlay">
                        <div className="spinner"></div>
                        <p>Analyzing {textAnnotationType.toUpperCase()}...</p>
                    </div>}
                    {error && <div className="error-message">{error}</div>}
                    <div className="panel-header">
                        <h2>Text Annotation</h2>
                        <div className="panel-actions">
                            <div className="text-analysis-controls">
                                <label htmlFor="text-analysis-type" className="sr-only">Analysis Type</label>
                                <select
                                    id="text-analysis-type"
                                    value={textAnnotationType}
                                    onChange={e => {
                                        setTextAnnotationType(e.target.value as TextAnnotationType);
                                        setTextAnalysisResult(null);
                                    }}
                                    disabled={!isTextLoaded}
                                >
                                    <option value="ner">Named Entity Recognition</option>
                                    <option value="sentiment">Sentiment Analysis</option>
                                    <option value="pos">Part-of-Speech Tagging</option>
                                </select>
                                <button className="analyze-btn" onClick={generateTextAnnotations} disabled={!isTextLoaded}>Analyze</button>
                            </div>
                            <div className="download-dropdown-container" ref={downloadDropdownRef}>
                                <button
                                    className="download-btn"
                                    onClick={() => setIsDownloadDropdownOpen(!isDownloadDropdownOpen)}
                                    disabled={!textAnalysisResult}
                                    aria-label="Download annotations"
                                    title="Download annotations"
                                >
                                    Download
                                </button>
                                {isDownloadDropdownOpen && (
                                    <div className="download-dropdown-menu">
                                        <button className="download-dropdown-item" onClick={downloadJson}>JSON</button>
                                        <button className="download-dropdown-item" onClick={downloadJsonl}>JSONL</button>
                                        <button className="download-dropdown-item" onClick={downloadTextCsv}>CSV</button>
                                        <button className="download-dropdown-item" onClick={downloadTextXml}>XML</button>
                                        {textAnnotationType === 'ner' && (
                                             <button className="download-dropdown-item" onClick={downloadBio}>BIO Tagging</button>
                                        )}
                                    </div>
                                )}
                            </div>
                            <button className="clear-btn" onClick={resetState} disabled={!isTextLoaded} aria-label="Clear text and all analysis" title="Clear text and all analysis">Clear</button>
                        </div>
                    </div>
                    <div className="annotations-list">
                         {isTextLoaded && !isLoading && (
                            renderTextAnalysisResults()
                        )}
                        {!isTextLoaded && !isLoading && (
                            <div className="placeholder">
                                Upload a file or paste text to begin.
                            </div>
                        )}
                    </div>
                </div>
            </main>
            {isManualOpen && <ManualModal />}
        </div>
    );
};

const container = document.getElementById('root');
if (container) {
    const root = createRoot(container);
    root.render(<App />);
}