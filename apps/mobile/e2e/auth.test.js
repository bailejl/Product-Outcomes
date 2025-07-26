describe('Authentication Flow', () => {
  beforeAll(async () => {
    await device.launchApp();
  });

  beforeEach(async () => {
    await device.reloadReactNative();
  });

  it('should show welcome screen on first launch', async () => {
    await expect(element(by.text('Product Outcomes'))).toBeVisible();
    await expect(element(by.text('Get Started'))).toBeVisible();
    await expect(element(by.text('Sign In'))).toBeVisible();
  });

  it('should navigate to login screen', async () => {
    await element(by.text('Sign In')).tap();
    await expect(element(by.text('Welcome Back'))).toBeVisible();
    await expect(element(by.text('Sign in to your account'))).toBeVisible();
  });

  it('should navigate to register screen', async () => {
    await element(by.text('Get Started')).tap();
    await expect(element(by.text('Create Account'))).toBeVisible();
    await expect(element(by.text('Join us to start achieving your goals'))).toBeVisible();
  });

  it('should show validation error for empty login form', async () => {
    await element(by.text('Sign In')).tap();
    await element(by.text('Sign In')).tap();
    // Wait for alert
    await waitFor(element(by.text('Error')))
      .toBeVisible()
      .withTimeout(2000);
    await expect(element(by.text('Please fill in all fields'))).toBeVisible();
  });

  it('should navigate between login and register screens', async () => {
    await element(by.text('Sign In')).tap();
    await element(by.text('Sign Up')).tap();
    await expect(element(by.text('Create Account'))).toBeVisible();
    
    await element(by.text('Sign In')).tap();
    await expect(element(by.text('Welcome Back'))).toBeVisible();
  });
});