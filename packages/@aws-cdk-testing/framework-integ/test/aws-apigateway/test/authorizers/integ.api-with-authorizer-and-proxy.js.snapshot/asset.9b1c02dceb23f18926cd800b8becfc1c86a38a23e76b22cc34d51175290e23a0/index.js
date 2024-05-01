exports.handler = async function (event) {
  console.log("Event: ", event);
  return {
    statusCode: 200,
    body: JSON.stringify({ message: "Hello from Lambda l2!" }),
  };
};
