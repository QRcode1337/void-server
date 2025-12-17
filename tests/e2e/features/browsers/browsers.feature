@ui
Feature: Browser Profile Management
  As a user
  I want to manage browser profiles for authentication
  So that plugins can use authenticated sessions

  Background:
    Given I am on the browsers page

  @smoke
  Scenario: Browser profiles page loads
    Then I should see the "Browser Profiles" heading
    And I should see the "New Profile" button

  Scenario: Create a browser profile
    When I click the "New Profile" button
    And I fill in the profile form:
      | id          | test-browser-profile     |
      | name        | Test Browser             |
      | description | E2E test browser profile |
    And I click the "Create Profile" button
    Then I should see a success toast
    And I should see "Test Browser" in the browser list

  Scenario: Delete a browser profile
    Given a browser profile "delete-me-profile" exists
    When I delete the browser profile "delete-me-profile"
    Then I should see a success toast
    And I should not see "delete-me-profile" in the browser list

  @requires-docker
  Scenario: Docker browser info banner shows in Docker mode
    Then I should see the Docker browser mode info banner

  @api
  Scenario: Browser profiles API returns list
    When I GET "/api/browsers"
    Then the response should be successful
    And the response should have "browsers" array

  @api
  Scenario: Create browser profile via API
    When I POST to "/api/browsers" with:
      | id          | api-test-profile |
      | name        | API Test Browser |
      | description | Created via API  |
    Then the response should be successful
    And the response should have "browser" object

  @api
  Scenario: Delete browser profile via API
    Given a browser profile "api-delete-profile" exists via API
    When I DELETE "/api/browsers/api-delete-profile"
    Then the response should be successful

  @api
  Scenario: Get port configuration
    When I GET "/api/browsers/config/ports"
    Then the response should be successful
    And the response should have "portRange" object
