@requires-ipfs @ui
Feature: IPFS Integration
  As a user
  I want to manage IPFS content
  So that I can store data on the distributed network

  Background:
    Given I am on the IPFS page

  Scenario: IPFS page loads
    Then I should see the IPFS interface
    And I should see the daemon status

  @requires-ipfs
  Scenario: IPFS daemon online
    Given IPFS daemon is running
    Then I should see "Online" status

  Scenario: IPFS daemon offline
    Given IPFS daemon is not running
    Then I should see "Offline" status

  @api @smoke
  Scenario: API - Get IPFS status
    When I GET "/api/ipfs/status"
    Then the response should contain daemon status

  @api @requires-ipfs
  Scenario: API - List pins
    Given IPFS daemon is running
    When I GET "/api/ipfs/pins"
    Then the response should be successful
