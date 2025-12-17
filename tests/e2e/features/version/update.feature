@ui
Feature: Version and Updates
  As a user
  I want to check for and apply updates
  So that I can keep the application current

  @smoke @api
  Scenario: Get current version
    When I GET "/api/version"
    Then the response should contain the version

  @api
  Scenario: Check for updates
    When I GET "/api/version/check"
    Then the response should contain update information

  @native
  Scenario: Native update available notification
    Given an update is available
    And I am running native installation
    Then I should see the update notification

  @docker
  Scenario: Docker update notification
    Given an update is available
    And I am running in Docker
    Then I should see Docker-specific update instructions
