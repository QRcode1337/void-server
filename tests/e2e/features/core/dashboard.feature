@smoke @ui
Feature: Dashboard
  As a user
  I want to see the application dashboard
  So that I can view service status and navigate the application

  Background:
    Given I am on the dashboard page

  @smoke
  Scenario: Dashboard loads successfully
    Then I should see the page heading
    And the health check should return ok

  @smoke
  Scenario: Service status indicators are displayed
    Then I should see the "Neo4j" service indicator
    And I should see the "LM Studio" service indicator
    And I should see the "IPFS" service indicator

  @requires-neo4j
  Scenario: Neo4j connected status
    Then the "Neo4j" service should show "Connected" status

  @requires-lmstudio
  Scenario: LM Studio running status
    Then the "LM Studio" service should show "Running" status

  @requires-ipfs
  Scenario: IPFS online status
    Then the "IPFS" service should show "Online" status

  @api @smoke
  Scenario: Health endpoint returns ok
    When I request the health endpoint
    Then the response status should be "ok"

  @api @smoke
  Scenario: Version endpoint returns version
    When I request the version endpoint
    Then the response should contain a version number
