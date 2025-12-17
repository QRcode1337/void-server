#!/usr/bin/env node
/**
 * Seed test data for E2E testing
 * Creates predictable test fixtures in Neo4j
 */

const neo4j = require('neo4j-driver');

const NEO4J_URI = process.env.NEO4J_URI || 'bolt://localhost:7687';
const NEO4J_USER = process.env.NEO4J_USER || 'neo4j';
const NEO4J_PASSWORD = process.env.NEO4J_PASSWORD || 'testpassword';

const TEST_MEMORIES = [
  {
    id: 'test-memory-1',
    content: 'Test memory about AI development',
    category: 'development',
    stage: 1,
    importance: 0.8,
    tags: ['ai', 'test', 'development'],
  },
  {
    id: 'test-memory-2',
    content: 'Test memory about user interactions',
    category: 'interaction',
    stage: 2,
    importance: 0.6,
    tags: ['user', 'test', 'interaction'],
  },
  {
    id: 'test-memory-3',
    content: 'Test memory for search functionality',
    category: 'emergence',
    stage: 1,
    importance: 0.9,
    tags: ['search', 'test', 'important'],
  },
];

async function seedDatabase() {
  console.log('Connecting to Neo4j...');
  const driver = neo4j.driver(NEO4J_URI, neo4j.auth.basic(NEO4J_USER, NEO4J_PASSWORD));

  const session = driver.session();

  console.log('Clearing existing test data...');
  await session.run(`
    MATCH (m:Memory)
    WHERE m.id STARTS WITH 'test-'
    DETACH DELETE m
  `);

  console.log('Seeding test memories...');
  for (const memory of TEST_MEMORIES) {
    await session.run(
      `
      CREATE (m:Memory {
        id: $id,
        content: $content,
        category: $category,
        stage: $stage,
        importance: $importance,
        tags: $tags,
        timestamp: datetime(),
        type: 'test'
      })
    `,
      memory
    );
    console.log(`  Created: ${memory.id}`);
  }

  console.log('Creating test relationships...');
  await session.run(`
    MATCH (m1:Memory {id: 'test-memory-1'})
    MATCH (m2:Memory {id: 'test-memory-2'})
    CREATE (m1)-[:RELATES_TO {timestamp: datetime()}]->(m2)
  `);

  await session.close();
  await driver.close();

  console.log('Test data seeded successfully!');
}

async function clearDatabase() {
  console.log('Connecting to Neo4j...');
  const driver = neo4j.driver(NEO4J_URI, neo4j.auth.basic(NEO4J_USER, NEO4J_PASSWORD));

  const session = driver.session();

  console.log('Clearing ALL test data...');
  await session.run(`
    MATCH (m:Memory)
    WHERE m.id STARTS WITH 'test-'
    DETACH DELETE m
  `);

  await session.close();
  await driver.close();

  console.log('Test data cleared!');
}

const command = process.argv[2];

switch (command) {
  case 'seed':
    seedDatabase().catch(console.error);
    break;
  case 'clear':
    clearDatabase().catch(console.error);
    break;
  default:
    console.log('Usage: node seed-test-data.js [seed|clear]');
    process.exit(1);
}
