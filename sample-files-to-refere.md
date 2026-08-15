----------------  SignUp ---------------- 

```
{
 firstName : 'John',
 lastName: 'Doe',
 email: 'JohnDoe{{timestamp}}@mailinator.com',
 age: '21',
 gender: 'male',
 country: 'India'
}```



<!-- locators-signup.json -->
```

{
 firstName : {  locator: 'xpath-to-firstName',  type: textbox }, 
 lastName: {  locator:  'css-to-lastname', type: textbox }, 
 email:  {  locator: 'regex-to-email', type: textbox }, 
 age: {  locator: 'playwright-default-accessibility-locators', type: textbox }, 
 gender: {  locator:  'xxxxx', type: radio }, 
 country: {  locator:  'xxxxx', type: dropdown }, 
}```

---------------- Travel ---------------- 

{  
    ackgknowdgement: "{{ackgknowdgement-no-generated-in-current-session}}"  
    visaDate:  "{{TODAY-20}}"  
    startDate : "{{TODAY+10}}",  
    endtDate : "{{TODAY+365}}"

}

---

```
{
    dev: {
        globa:{
            token: '',
            baseUrl: ''
        },
        {
            travel:{
                "ackgknowdgement-no-generated-in-current-session": 12345
            }
        },

        test_1: {
            id: 'dynamic-id-1'
        },
          test_2: {
            id: 'dynamic-id-2'
        },



    },

    qa:{

         globa:{
            token: '',
            baseUrl: ''
        },

        test_1: {
            id: 'dynamic-id-1'
        },
          test_2: {
            id: 'dynamic-id-2'
        }



    }

}
```

---

- I want a method/function that takes both locators, test-data as arguments and populates if test-data in a valid value and by knowing the locator and its type. 
- This method is extermely helpfull to populate pages/forms developed using form.io, where each element will have unique id and the same id can be used in test-data json file and then populate data
- Also consider actions like click, wait during the population - which means need a to handle other actions while populating the page

