export function parseJson<E>(data: string): E {
  const rdata: E = JSON.parse(data)
  return rdata
}
