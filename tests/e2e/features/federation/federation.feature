@api
Feature: Federation System
  As a void-server operator
  I want to federate with other void-server instances
  So that I can share memories across the network

  @smoke
  Scenario: Federation manifest endpoint
    When I GET "/api/federation/manifest"
    Then the response should be successful
    And the response should contain a manifest

  @smoke
  Scenario: Federation identity endpoint
    When I GET "/api/federation/identity"
    Then the response should be successful
    And the response should contain server identity

  Scenario: Federation status endpoint
    When I GET "/api/federation/status"
    Then the response should be successful
    And the response should contain federation status

  Scenario: Federation peers list (empty)
    When I GET "/api/federation/peers"
    Then the response should be successful
    And the response should have "peers" array

  Scenario: Federation challenge generation
    When I POST to "/api/federation/verify/challenge" with empty body
    Then the response should be successful
    And the response should contain a challenge

  Scenario: Add peer with invalid endpoint
    When I POST to "/api/federation/peers" with invalid endpoint
    Then the response status should be 400

  Scenario: Remove non-existent peer
    When I DELETE "/api/federation/peers/non-existent-peer"
    Then the response status should be 404

  Scenario: Federation ping
    When I POST to "/api/federation/ping" with empty body
    Then the response should be successful
    And the response should contain server ID

  # DHT Tests

  @smoke
  Scenario: DHT status endpoint
    When I GET "/api/federation/dht/status"
    Then the response should be successful
    And the response should contain DHT status

  Scenario: DHT nodes endpoint
    When I GET "/api/federation/dht/nodes"
    Then the response should be successful
    And the response should have "nodes" array

  Scenario: DHT bootstrap nodes endpoint
    When I GET "/api/federation/dht/bootstrap-nodes"
    Then the response should be successful
    And the response should have "bootstrapNodes" array

  Scenario: DHT find-node requires targetId
    When I POST to "/api/federation/dht/find-node" with empty body
    Then the response status should be 400

  # Neo4j Peer Management Tests

  @smoke
  Scenario: Neo4j peer stats endpoint
    When I GET "/api/federation/peers/neo4j/stats"
    Then the response should be successful
    And the response should contain Neo4j peer stats

  Scenario: Neo4j peers list (initially empty or has test data)
    When I GET "/api/federation/peers/neo4j"
    Then the response should be successful
    And the response should have "peers" array

  Scenario: Neo4j trust graph endpoint
    When I GET "/api/federation/peers/neo4j/graph"
    Then the response should be successful
    And the response should contain trust graph

  Scenario: Create and manage peer in Neo4j
    When I create a test peer "void-e2etest01" in Neo4j
    Then the response should be successful
    And the peer should exist in Neo4j
    When I get trust score for peer "void-e2etest01"
    Then the response should be successful
    And the response should contain trust score
    When I block peer "void-e2etest01"
    Then the peer should be blocked
    When I unblock peer "void-e2etest01"
    Then the peer should be unblocked
    When I delete peer "void-e2etest01" from Neo4j
    Then the response should be successful

  Scenario: Create trust relationship between peers
    When I create a test peer "void-e2etest02" in Neo4j
    And I create a test peer "void-e2etest03" in Neo4j
    And I create trust relationship from "void-e2etest02" to "void-e2etest03"
    Then the response should be successful
    When I GET "/api/federation/peers/neo4j/graph"
    Then the trust graph should contain relationship from "void-e2etest02" to "void-e2etest03"
    When I delete peer "void-e2etest02" from Neo4j
    And I delete peer "void-e2etest03" from Neo4j
    Then the response should be successful

  # Secure Communication Tests

  @smoke
  Scenario: Crypto self-test endpoint
    When I POST to "/api/federation/test-crypto" with empty body
    Then the response should be successful
    And the response should contain successful crypto test

  Scenario: Secure message requires serverId
    When I POST to "/api/federation/secure-message" with empty body
    Then the response status should be 400

  Scenario: Verify peer requires serverId
    When I POST to "/api/federation/verify-peer" with empty body
    Then the response status should be 400

  # Memory Sync Tests

  @smoke
  Scenario: Memory export endpoint
    When I POST to "/api/federation/memories/export" with limit 5
    Then the response should be successful
    And the response should contain memory export manifest
    And the exported memories should have content hashes

  Scenario: Memory sync stats endpoint
    When I GET "/api/federation/memories/sync/stats"
    Then the response should be successful
    And the response should contain sync stats

  Scenario: Memory sync states endpoint
    When I GET "/api/federation/memories/sync/states"
    Then the response should be successful
    And the response should have "states" array

  Scenario: Memory export with category filter
    When I POST to "/api/federation/memories/export" with category "emergence"
    Then the response should be successful
    And the exported memories should all have category "emergence"

  Scenario: Memory import requires export data
    When I POST to "/api/federation/memories/import" with empty body
    Then the response status should be 400

  Scenario: Memory import dry run
    When I POST to "/api/federation/memories/export" with limit 2
    And I import the exported memories with dry run
    Then the response should be successful
    And the import should be a dry run

  Scenario: Delta sync requires known peer
    When I POST to "/api/federation/memories/sync/unknown-peer"
    Then the response status should be 404
