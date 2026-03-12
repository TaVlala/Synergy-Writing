export async function parseJsonResponse(response) {
  return response.json().catch(() => ({}));
}

export async function requestJson(fetcher, url, options = {}) {
  const response = await fetcher(url, options);
  const data = await parseJsonResponse(response);
  if (!response.ok) {
    throw new Error(data?.error || `Request failed: ${response.status}`);
  }
  return data;
}

export function createJsonOptions(method, body, headers = {}) {
  return {
    method,
    headers: { 'Content-Type': 'application/json', ...headers },
    body: JSON.stringify(body),
  };
}
