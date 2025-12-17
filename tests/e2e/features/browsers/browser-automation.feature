@api
Feature: Browser Automation
  As a plugin developer
  I want to use authenticated browser profiles for automation
  So that I can download files and interact with authenticated services

  Background:
    Given a browser profile "automation-test" exists via API

  @automation
  Scenario: Download a file using browser profile
    When I trigger a download using profile "automation-test"
    Then the download should complete successfully
    And the downloaded file should exist

  @automation
  Scenario: Navigate to a page using browser profile
    When I navigate to "https://github.com/ClawedCode/void-server" using profile "automation-test"
    Then the page title should contain "void-server"

  @api
  Scenario: Get browser context status
    When I GET "/api/browsers/automation-test/status"
    Then the response should be successful
