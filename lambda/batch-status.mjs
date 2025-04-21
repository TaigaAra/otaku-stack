import AWS from "aws-sdk";
import fetch from "node-fetch";

const dynamoDb = new AWS.DynamoDB.DocumentClient();
const MANGADEX_API_URL = "https://api.mangadex.org";
const TABLE_NAME = "TABLE_NAME"; // Replace TABLE_NAME with your DynamoDB table name
const BATCH_SIZE = 4;
const DELAY_BETWEEN_BATCHES = 1500;
const DRY_RUN = false;

export const handler = async (event) => {
  try {
    const mangaRecords = await fetchAllMangaRecords();
    const mangaGroups = groupByMangaId(mangaRecords);

    const mangaIds = Object.keys(mangaGroups);
    for (let i = 0; i < mangaIds.length; i += BATCH_SIZE) {
      const batch = mangaIds.slice(i, i + BATCH_SIZE);

      await Promise.all(
        batch.map((mangaId) => updateStatus(mangaId, mangaGroups[mangaId]))
      );

      if (i + BATCH_SIZE < mangaIds.length) {
        await new Promise((resolve) =>
          setTimeout(resolve, DELAY_BETWEEN_BATCHES)
        );
      }
    }

    return {
      statusCode: 200,
      body: "Batch update for statuses completed successfully.",
    };
  } catch (error) {
    return { statusCode: 500, body: "Batch update for statuses failed." };
  }
};

// Fetch all manga records from DynamoDB
async function fetchAllMangaRecords() {
  const params = {
    TableName: TABLE_NAME,
  };

  const records = [];
  let lastEvaluatedKey = null;

  do {
    const result = await dynamoDb.scan(params).promise();
    records.push(...result.Items);
    lastEvaluatedKey = result.LastEvaluatedKey;
    params.ExclusiveStartKey = lastEvaluatedKey;
  } while (lastEvaluatedKey);

  return records;
}

// Group manga records by mangaId
function groupByMangaId(mangaRecords) {
  return mangaRecords.reduce((groups, record) => {
    const mangaId = record.mangaId;
    if (!groups[mangaId]) {
      groups[mangaId] = [];
    }
    groups[mangaId].push(record);
    return groups;
  }, {});
}

// Fetch the status for a mangaId and update all related entries
async function updateStatus(mangaId, entries) {
  try {
    const response = await fetch(`${MANGADEX_API_URL}/manga/${mangaId}`);
    if (!response.ok) {
      throw new Error(`Failed to fetch manga details for ${mangaId}`);
    }

    const data = await response.json();
    const currentStatus = data.data?.attributes?.status || "unknown";

    await Promise.all(
      entries.map(async (entry) => {
        if (DRY_RUN) {
          return;
        } else {
          await dynamoDb
            .update({
              TableName: TABLE_NAME,
              Key: {
                userId: entry.userId,
                mangaId: entry.mangaId,
              },
              UpdateExpression: "SET #status = :status",
              ExpressionAttributeNames: {
                "#status": "status",
              },
              ExpressionAttributeValues: {
                ":status": currentStatus,
              },
            })
            .promise();
        }
      })
    );
  } catch (error) {
    console.error(`Error updating status for manga ID ${mangaId}:`, error);
  }
}
