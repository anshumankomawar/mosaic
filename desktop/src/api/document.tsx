import { getToken } from "@/lib/stronghold";
import useSummaryStore from "@/stores/summaryStore";
import { toast } from "sonner";

/**
 *
 * @param query - Search string used to find the relevant documents
 * @param textContents - List of document contents to summarize
 * @returns A JSON response of the request
 * @throws Error - If the summary fails to generate
 */
export async function summarize(query: string, textContents: string[]) {
  const setSummary = useSummaryStore.getState().setSummary;
  const token = await getToken();
  const summaryResponse = await fetch(
    "http://localhost:8000/secure/summarize",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        chunks: textContents,
        name: `Search: ${query}`,
      }),
    },
  );

  if (summaryResponse.ok) {
    const data = await summaryResponse.json();
    setSummary(data.summary);
    return data;
  }

  throw new Error(`Failed to get summary: ${summaryResponse}`);
}

/**
 * Update an existing document
 * @param props Object containing document update properties
 * @returns The updated document data
 * @throws Error - If the document fails to update
 */
export async function updateDocument(props: {
  documentId: string;
  title: string;
  content: string;
  fileType?: string;
}) {
  const { documentId, title, content, fileType = "txt" } = props;
  const token = await getToken();
  
  toast("Updating document...");
  
  const response = await fetch("http://localhost:8000/document", {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      document_id: documentId,
      name: title,
      file_content: content,
      file_type: fileType
    }),
  });

  if (response.ok) {
    const data = await response.json();
    console.log("Updated document with response: ", data);
    toast.success("Document updated successfully");
    return data;
  }
  
  toast.error("Failed to update document");
  throw new Error(`Failed to update document: ${response.statusText}`);
}

/**
 *
 * @param query - Search string used to find the relevant documents
 * @returns - JSON response from the API call
 * @throws - Error when the search fails
 */
export async function search_chunks(query: string) {
  const token = await getToken();
  const searchResponse = await fetch(
    "http://localhost:8000/secure/search_chunks",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        query: query,
        matches: 5,
      }),
    },
  );

  if (searchResponse.ok) {
    return await searchResponse.json();
  }

  throw new Error(`Search failed: ${searchResponse}`);
}

export type DocumentProps = {
  title: string;
  content: string;
};

/**
 * Search for documents with optional file type filtering
 * @param query Search query string
 * @param fileType Optional file type filter (e.g., 'pdf', 'txt')
 * @returns Search results from the server
 */
export async function searchDocuments(query: string, fileType?: string) {
  try {
    const token = await getToken();
    const response = await fetch("http://localhost:8000/secure/file_search", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        query,
        file_type: fileType,
      }),
    });

    if (response.ok) {
      return await response.json();
    }

    throw new Error(`Failed to search documents: ${response.statusText}`);
  } catch (error) {
    console.error("Error searching documents:", error);
    return null;
  }
}

/**
 *
 * @param props - DocumentProps which contains the title and content of the document
 * @throws Error - If the document fails to save
 */
export async function saveDocument(props: DocumentProps) {
  const { title, content } = props;
  const token = await getToken();
  toast("Saving current document...");
  console.log("HERES TITLE", title)
  const response = await fetch("http://localhost:8000/secure/document", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      name: title,
      file_content: content,
      file_type: "txt"
    }),
  });

  if (response.ok) {
    const data = await response.json();
    console.log("Saved document with response: ", data);
    return;
  }
  console.log(response);
  toast("Failed to save document");
  throw new Error(`Failed to save document: ${response}`);
}

export async function getFiles() {
  try {
    const token = await getToken();
    const response = await fetch("http://localhost:8000/secure/document", {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
    });

    if (!response.ok) {
      throw new Error(
        `Failed to fetch documents: ${response.status} ${response.statusText}`,
      );
    }

    const data = await response.json();
    return data.documents || [];
  } catch (error) {
    console.error("Error fetching documents:", error);
    throw error;
  }
}
