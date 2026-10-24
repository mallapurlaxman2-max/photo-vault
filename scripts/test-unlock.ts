async function test() {
  const res = await fetch("https://bikini-fixtures-border-flavor.trycloudflare.com/api/public/gallery/rahul-priya-wedding/unlock", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ password: "1234" })
  });
  console.log("Status:", res.status);
  console.log("Response:", await res.json());
}

test();
