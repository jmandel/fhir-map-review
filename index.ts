import { convert } from 'html-to-text';
import OpenAI from 'openai';

const openai = new OpenAI();

function extractElements(structureDefinition, v) {
    // Check if snapshot and element array exist
    if (!structureDefinition.snapshot || !structureDefinition.snapshot.element) {
        return [];
    }

    // Map each element to extract required properties
    return structureDefinition.snapshot.element.map(element => {
        return {
            [v + "ElementId"]: element.path,
            short: element.short,
            definition: element.definition,
            min: element.min,
            max: element.max,
            type: element.type ? element.type.map(type => {
                // Extract the code of each type, if type is defined
                return { code: type.code };
            }) : undefined
        };
    });
}


const cache = {}
async function toElements(fhirVersion, resourceName){
  const url = `https://hl7.org/fhir/${fhirVersion}/${resourceName.toLowerCase()}.profile.json`;
  if (cache[url] !== undefined) return cache[url] ?  extractElements(cache[url], targetFhirVersion) : null;
  try {
    const response = await fetch(url);
    console.error(url)
    const sd = await response.json();
    cache[url] = sd;
    return extractElements(sd, fhirVersion)
  } catch (error) {
    console.error('Error fetching or converting:', url, error);
    cache[url] = null;
    return null;
  }

}
async function fetchHtmlAsText(fhirVersion, resourceName) {
  const url = `https://hl7.org/fhir/${fhirVersion}/${resourceName}-definitions.html`;
  try {
    const response = await fetch(url);
    const html = await response.text();
    return convert(html, {
      wordwrap: 1300
    });
  } catch (error) {
    console.error('Error fetching or converting:', error);
    throw error;
  }
}

async function generateOpenAiPrompt(sourceFhirVersion, sourceElementName, targetFhirVersion) {
  const resource = sourceElementName.split('.')[0];
  const sourceHtmlText = JSON.stringify(await toElements(sourceFhirVersion, resource), null, 2)
  const targetHtmlText = JSON.stringify(await toElements(targetFhirVersion, resource), null, 2)
  if (sourceHtmlText === "null" || targetHtmlText === "null"){
    return null;
  }
  console.error(sourceElementName)
    const messages = [
      {
        role: "system",
        content: "You are a helpful assistant for managing health informatics standards. You are careful, complete, and accurate."
      },
      {
        role: "user",
        content: `Here is FHIR ${sourceFhirVersion} ${resource}: ${sourceHtmlText}`
      },
      {
        role: "user",
        content: `Here is the FHIR ${targetFhirVersion} ${resource}: ${targetHtmlText}`
      },
      {
        role: "user",
        content: `Now let's discuss the ${sourceFhirVersion} source element called "${sourceElementName}". Is there any direct equivalent target element in ${targetFhirVersion} ${resource}? For example, a renaming of this element? Maintain a strict threshold of quality and think carefully but very succinctly. Do not report 'similar' or generalized items, only direct equivalents.

Output a JSON structure like

${"```"}
interface Output {
  "${sourceFhirVersion}ElementId": string, // src element path
  "potential${targetFhirVersion}Targets": {
    "${targetFhirVersion}ElementId": string, // target element path or "None"
    "rationale": string, // brief explanation of fit
    "qualityOfMatch": "strong" | "medium" | "weak"
  }[]
}
${"```"}
`
      }
    ]
  const response = await openai.chat.completions.create({
    model: "gpt-4-1106-preview",
    messages,
    temperature: 1,
    max_tokens: 512,
    top_p: 1,
    frequency_penalty: 0,
    presence_penalty: 0,
    response_format: { type: "json_object" },
  });


  return response.choices[0].message.content;
}


const sourceFhirVersion = 'R4'; // replace with actual input
const targetFhirVersion = 'R5'; // replace with actual input
const path = "R4-R5.txt";
const file = Bun.file(path);
const elements = (await file.text()).split("\n").map(e => e.trim()).slice(1).filter(e => !!e);
console.log(elements)

for (const sourceElementName of elements) {
    const resourceName = sourceElementName.split('.')[0];
    let r = await generateOpenAiPrompt(sourceFhirVersion, sourceElementName, targetFhirVersion);
    try {
        const p = JSON.parse(r)
        console.error(p)
        if (p !== null) {
            const tProp = "potential"+targetFhirVersion+"Targets"
            const url = `https://hl7.org/fhir/${targetFhirVersion}/${resourceName.toLowerCase()}.profile.json`;
            const eExists = (ePath) => {
                return cache[url].snapshot.element.filter(e => e.path === ePath).length
            }
            p[tProp] = p[tProp].filter(e => eExists(e[targetFhirVersion + "ElementId"]))
            if (p[tProp].length > 0) {
                r = JSON.stringify(p, null, 2)
            } else {
                r = null;
            }
        }
    } catch (e){
        console.error(e)
        r = "null";
    }
    if (r !== "null" && r !== null) {
        console.log(r)
    }
}
