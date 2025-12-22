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

  # Token Gate Tests

  @smoke
  Scenario: Token gate config endpoint
    When I GET "/api/federation/token-gate/config"
    Then the response should be successful
    And the response should contain token gate config

  Scenario: Token gate check requires wallet
    When I GET "/api/federation/token-gate/check"
    Then the response status should be 400

  Scenario: Token gate check with invalid wallet
    When I GET "/api/federation/token-gate/check?wallet=invalid"
    Then the response status should be 400
    And the response should contain "Invalid wallet address format"

  Scenario: Token gate check with valid wallet
    When I GET "/api/federation/token-gate/check?wallet=4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU"
    Then the response should be successful
    And the response should contain tier information

  Scenario: Token gate check with feature
    When I GET "/api/federation/token-gate/check?wallet=4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU&feature=federation:read_memories"
    Then the response should be successful
    And the response should contain access information

  Scenario: Gated endpoint requires wallet
    When I POST to "/api/federation/gated/memories/export" with empty body
    Then the response status should be 401
    And the response should contain "Wallet address required"

  Scenario: Gated endpoint rejects insufficient balance
    When I POST to "/api/federation/gated/memories/export" with wallet header "4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU"
    Then the response status should be 403
    And the response should contain "Insufficient $CLAWED balance"

  # Memory Marketplace Tests

  @smoke
  Scenario: Marketplace stats endpoint
    When I GET "/api/federation/marketplace/stats"
    Then the response should be successful
    And the response should contain marketplace stats

  Scenario: Marketplace top memories endpoint
    When I GET "/api/federation/marketplace/top-memories"
    Then the response should be successful
    And the response should have "memories" array

  Scenario: Marketplace top contributors endpoint
    When I GET "/api/federation/marketplace/top-contributors"
    Then the response should be successful
    And the response should have "contributors" array

  Scenario: Get contributor profile (non-existent)
    When I GET "/api/federation/marketplace/contributor/void-nonexistent"
    Then the response status should be 404

  Scenario: Register and get contributor
    When I register contributor "void-e2etest-contrib"
    Then the response should be successful
    And the response should contain contributor profile
    When I GET "/api/federation/marketplace/contributor/void-e2etest-contrib"
    Then the response should be successful
    And the response should contain contributor profile

  Scenario: Record view and interaction on memory
    When I POST to "/api/federation/marketplace/memory/test-memory-001/view" with empty body
    Then the response should be successful
    When I POST to "/api/federation/marketplace/memory/test-memory-001/interaction" with interaction "used_in_chat"
    Then the response should be successful

  Scenario: Vote on memory requires valid vote
    When I POST to "/api/federation/marketplace/memory/test-memory-002/vote" with empty body
    Then the response status should be 400
    And the response should contain "Vote must be 1 or -1"

  Scenario: Vote on memory with voter
    When I POST to "/api/federation/marketplace/memory/test-memory-003/vote" with vote 1 from "void-voter-test"
    Then the response should be successful
    And the response should contain vote result

  Scenario: Get memory quality score
    When I GET "/api/federation/marketplace/memory/test-memory-001/quality"
    Then the response should be successful
    And the response should contain quality score

  Scenario: Get memory attribution chain
    When I GET "/api/federation/marketplace/memory/test-memory-001/attribution"
    Then the response should be successful
    And the response should have "chain" array

  Scenario: Record citation between memories
    When I POST to "/api/federation/marketplace/memory/test-memory-004/cite" with citing memory "test-memory-005"
    Then the response should be successful