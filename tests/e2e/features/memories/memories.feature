@requires-neo4j @ui
Feature: Memories System
  As a user
  I want to manage memories in the knowledge graph
  So that the AI can maintain context

  Background:
    Given Neo4j is running and configured
    And I am on the memories page

  @smoke @requires-neo4j
  Scenario: Memories page loads
    Then I should see the "Memories" heading
    And I should see the memory list or empty state

  @requires-neo4j
  Scenario: Create and delete memory
    When I click the "New Memory" button
    And I fill in the memory form
    And I save the memory
    Then the memory should appear in the list
    # Cleanup
    When I delete the test memory
    Then the test memory should be removed

  @requires-neo4j
  Scenario: Search memories
    Given I have memories in the system
    When I search for "test"
    Then I should see matching memories

  @requires-neo4j
  Scenario: View memory graph
    When I click the "Visualization" tab
    Then I should see the graph visualization

  @api @requires-neo4j @smoke
  Scenario: API - List memories
    When I GET "/api/memories"
    Then the response should contain memories

  @api @requires-neo4j
  Scenario: API - Get memory stats
    When I GET "/api/memories/stats"
    Then the response should contain statistics
