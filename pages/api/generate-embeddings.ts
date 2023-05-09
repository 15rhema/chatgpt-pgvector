import { Document } from 'next/document';
import { NextApiRequest, NextApiResponse } from "next";
import { supabaseClient } from "@/lib/embeddings-supabase";
import * as cheerio from "cheerio";
import officeParser from 'officeparser';
import { BLOCKED_PAGES } from "next/dist/shared/lib/constants";
import { Blob } from 'fetch-blob';
import  tmp  from 'tmp-promise';
import fs from 'fs/promises'
import pdfjsLib from 'pdfjs-dist';
import { getDocument } from "pdfjs-dist";
// embedding doc sizes
const docSize: number = 1000;

export default async function handle(
  req: NextApiRequest,
  res: NextApiResponse
) {
  const { method, body } = req;

  if (method === "POST") {
    const { urls } = body;
    const documents = await getDocuments(urls);

    for (const { url, body } of documents) {
      const input = body.replace(/\n/g, " ");

      console.log("\nDocument length: \n", body.length);
      console.log("\nURL: \n", url);

      const apiKey = process.env.OPENAI_API_KEY;
      const apiURL = process.env.OPENAI_PROXY == "" ? "https://api.openai.com" : process.env.OPENAI_PROXY;

      const embeddingResponse = await fetch(
        apiURL + "/v1/embeddings",
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${apiKey}`,
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            input,
            model: "text-embedding-ada-002"
          })
        }
      );
      // console.log("\nembeddingResponse: \n", embeddingResponse);
    
      
      const embeddingData = await embeddingResponse.json().catch(console.error);
                      //console.error("error with OpenAI call: " + error);

           
             console.log("embeddingData:" +  embeddingData);

            const [{ embedding }] = embeddingData.data;

       //console.log("embedding:" + embedding);

      // In production we should handle possible errors
      try {
        let res = await supabaseClient.from("documents").insert({
          content: input,
          embedding,
          url
        });
      }
      catch (error) {
        console.error("error in supabase insert: " + error);
      }

    }
    return res.status(200).json({ success: true });
  }

  return res
    .status(405)
    .json({ success: false, message: "Method not allowed" });
}

async function getPdfText(data: string) {
    let doc = await pdfjsLib.getDocument({data}).promise;
    let pageTexts = Array.from({length: doc.numPages}, async (v,i) => {
        return (await (await doc.getPage(i+1)).getTextContent()).items.map(token => token.str).join('');
    });
    return (await Promise.all(pageTexts)).join('');
}

async function getDocuments(urls: string[]) {
  const documents = [];
  for (const url of urls) {
    let fetchURL = url;
    if (process.env.SPLASH_URL != "") {
      fetchURL = `${process.env.SPLASH_URL}/render.html?url=${encodeURIComponent(url)}&timeout=10&wait=0.5`
    }
    console.log("fetching url: " + fetchURL);

    
    const response = await fetch(fetchURL)
    const blob = await response.blob()
    let articleText= '';

    if(fetchURL.indexOf('.docx') > 0){ 
      const tmpFile = await tmp.file({ postfix: '.docx' });
      await fs.writeFile(tmpFile.path, Buffer.from(await blob.arrayBuffer()));

      
       articleText = await officeParser.parseOfficeAsync(tmpFile.path, false)
      
      await tmpFile.cleanup();
    }
   if (fetchURL.indexOf('.pdf') > 0) {
       articleText = (await getPdfText(fetchURL)).toString()
    }
    if (!articleText) {
      articleText = '';
    }
    //const html = await response.text();
    //const $ = cheerio.load(html);
    // tag based e.g. <main>
    //const articleText = $("body").text();
    // class bsaed e.g. <div class="docs-content">
    // const articleText = $(".docs-content").text();

    let start = 0;
    while (start < articleText.length) {
      const end = start + docSize;
      const chunk = articleText.slice(start, end);
      documents.push({ url, body: chunk });
      start = end;
    }
  }
  return documents;
}
