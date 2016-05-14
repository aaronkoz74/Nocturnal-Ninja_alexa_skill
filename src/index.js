/**
    Copyright 2014-2015 Amazon.com, Inc. or its affiliates. All Rights Reserved.

    Licensed under the Apache License, Version 2.0 (the "License"). You may not use this file except in compliance with the License. A copy of the License is located at

        http://aws.amazon.com/apache2.0/

    or in the "license" file accompanying this file. This file is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied. See the License for the specific language governing permissions and limitations under the License.
*/

/**
 * This sample shows how to create a Lambda function for handling Alexa Skill requests that:
 * - Web service: communicate with an external web service to get guest data from TVMaze API (http://tidesandcurrents.noaa.gov/api/)
 *
 * Examples:
 * One-shot model:
 *  User:  "Alexa, ask Nocturnal Ninja who's going to be on The Late Show."
 *  Alexa: "Tonight, Stephen Colbert welcomes ... to the show."
 * Dialog model:
 *  User:  "Alexa, open Nocturnal Ninja"
 *  Alexa: "Welcome to Nocturnal Ninja. For which host or show would you like guest information?"
 *  User:  "Jimmy Fallon"
 *  Alexa: "Tonight, Jimmy Fallon welcomes ... to the show."
 */

'use strict';

var AlexaSkill = require('./AlexaSkill');

var APP_ID = 'amzn1.echo-sdk-ams.app.f3c3b651-1a73-4c64-bafe-1f7dd9a9ae28';

/**
 * NocturnalNinja is a child of AlexaSkill.
 * To read more about inheritance in JavaScript, see the link below.
 *
 * @see https://developer.mozilla.org/en-US/docs/Web/JavaScript/Introduction_to_Object-Oriented_JavaScript#Inheritance
 */
var NocturnalNinja = function () {
    AlexaSkill.call(this, APP_ID);
};

// Extend AlexaSkill
NocturnalNinja.prototype = Object.create(AlexaSkill.prototype);
NocturnalNinja.prototype.constructor = NocturnalNinja;

//NocturnalNinja.prototype.eventHandlers.onSessionStarted = function (sessionStartedRequest, session) {
//    console.log("onSessionStarted requestId: " + sessionStartedRequest.requestId
//        + ", sessionId: " + session.sessionId);
//    // any initialization logic goes here
//};

NocturnalNinja.prototype.eventHandlers.onLaunch = function (launchRequest, session, response) {
        var speechOutput = {
            speech: "<speak>Welcome to Nocturnal Ninja.  Your guide to who is going to be on the late night talk shows ... "
                + "For which host, or show, would you like guest information?</speak>",
            type: AlexaSkill.speechOutputType.SSML
        },
//        Offer help if user does not reply to initial question or says something not understood by Alexa
        repromptOutput = {
            speech: "For instructions on how to phrase your request, please say help me.",
            type: AlexaSkill.speechOutputType.PLAIN_TEXT
        };

    response.ask(speechOutput, repromptOutput);
};

//NocturnalNinja.prototype.eventHandlers.onSessionEnded = function (sessionEndedRequest, session) {
//    console.log("onSessionEnded requestId: " + sessionEndedRequest.requestId
//        + ", sessionId: " + session.sessionId);
//    // any cleanup logic goes here
//};

NocturnalNinja.prototype.intentHandlers = {
    "OneshotGuestListIntent": function (intent, session, response) {
        handleOneshotGuestListRequest(intent, session, response);
    },

    "DialogGuestListIntent": function (intent, session, response) {

        var showSlot = intent.slots.Show,
            hostSlot = intent.slots.Host;
        
        if (hostSlot.value || showSlot.value) {
            handleHostDialogRequest(intent, session, response);
        } else {
            handleNoSlotDialogRequest(intent, session, response);
        }
    },

    "AMAZON.HelpIntent": function (intent, session, response) {
        handleHelpRequest(response);
    },

    "AMAZON.StopIntent": function (intent, session, response) {
        var speechOutput = "Goodbye";
        response.tell(speechOutput);
    },

    "AMAZON.CancelIntent": function (intent, session, response) {
        var speechOutput = "Goodbye";
        response.tell(speechOutput);
    }
};

// -------------------------- NocturnalNinja Domain Specific Business Logic --------------------------

var SHOWCODE = {
    'the tonight show': 718,
    'the late show': 2756,
    'jimmy kimmel live': 1388
};

var SHOWS = {
    'the tonight show' : 'jimmy fallon',
    'jimmy kimmel live': 'jimmy kimmel',
    'the late show': 'stephen colbert'
};

var HOSTS = {
    'jimmy fallon': 'the tonight show',
    'jimmy kimmel': 'jimmy kimmel live',
    'stephen colbert': 'the late show'
};

function handleWelcomeRequest(response) {
    var whichHostPrompt = "For which host or show would you like guest information?",
        speechOutput = {
            speech: "<speak>Welcome to Nocturnal Ninja.  Your guide to who is going to be on late night talk shows. "
                + whichHostPrompt
                + "</speak>",
            type: AlexaSkill.speechOutputType.SSML
        },
        repromptOutput = {
            speech: "I can lead you through providing the name of the host or "
                + "show to get guest information, "
                + "or you can simply open Nocturnal Ninja and ask a question like, "
                + "who is going to be on Jimmy Kimmel? "
                + whichHostPrompt,
            type: AlexaSkill.speechOutputType.PLAIN_TEXT
        };

    response.ask(speechOutput, repromptOutput);
}

function handleHelpRequest(response) {
    var repromptText = "For which host or show would you like guest information?";
    var speechOutput = "I can lead you through providing the name of the host or "
                + "show to get guest information, "
                + "or you can simply open Nocturnal Ninja and ask a question like, "
                + "who is going to be on Jimmy Kimmel? "
        + "Or you can say exit. "
        + repromptText;

    response.ask(speechOutput, repromptText);
}

/**
 * Handles the dialog step where the user provides a host
 */

function handleHostDialogRequest(intent, session, response) {

    var showInfo = getShowHostFromIntent(intent, false),
        repromptText,
        speechOutput;
    if (showInfo.error) {
        repromptText = "Currently, I have guest information for these late night hosts: " + "Jimmy Fallon ," + "Stephen Colbert ," + "and Jimmy Kimmel. "
            + "For which host would you like guest information?";
        speechOutput = "I'm sorry, I didn't understand that name. " + repromptText;

        response.ask(speechOutput, repromptText);
        return;
    }

    getFinalGuestResponse(showInfo, response);


}

/**
 * This handles the one-shot interaction, where the user utters a phrase like:
 * 'Alexa, open Nocturnal Ninja and tell me who is going to be on Jimmy Kimmel.
 * If there is an error in a slot, this will guide the user to the dialog approach.
 */
function handleOneshotGuestListRequest(intent, session, response) {

    var hostSlot = intent.slots.Host,
        showSlot = intent.slots.Show,
        hostName,
        showName;

    if (hostSlot && hostSlot.value) {
        hostName = hostSlot.value,
        showName = HOSTS[hostName.toLowerCase()];
        
        return {
            host: hostName,
            showCode: SHOWCODE[showName].toString()
        } 
    } else if (showSlot && showSlot.value) {
        showName = showSlot.value,
        hostName = SHOWS[showName.toLowerCase()];
        
        return {
            host: hostName,
            showCode: SHOWCODE[showName].toString()
        } 
    } else {
        
    }
    
//    if (!hostSlot.value && !showSlot.value) {
//        if (!assignDefault) {
//            return {
//                error: true
//            }
//        } else {
//            // For sample skill, default to the code for Jimmy Fallon.
//            return {
//                host: 'jimmy fallon',
//                showCode: '718'
//            }
//        }
    } else {
        // lookup the show code.
        if (hostSlot.value) {
            var showInfo = hostSlot.value;
            var showName = HOSTS[showInfo.toLowerCase()];
        } else if (showSlot.value) {
            showName = showSlot.value;
            console.log('showName: ' + showName);
            showInfo = SHOWS[showName.toLowerCase()];
        }
        
        if (showName) {
            return {
                host: showInfo,
                showCode: SHOWCODE[showName].toString()
            }
        } else {
            return {
                error: true,
                host: showInfo
            }
        }
    }
    var showInfo = getShowHostFromIntent(intent, true),
        repromptText,
        speechOutput;
    if (showInfo.error) {
        // invalid show. move to the dialog
        repromptText = "Currently, I have guest information for these late night hosts: " + "Jimmy Fallon ," + "Stephen Colbert ," + "and Jimmy Kimmel. "
            + "For which host would you like guest information?";
        // if we received a value for the incorrect host, repeat it to the user, otherwise we received an empty slot
        speechOutput = showInfo.host ? "I'm sorry, I don't have any guest information for " + showInfo.host + ". " + repromptText : repromptText;

        response.ask(speechOutput, repromptText);
        return;
    }

    // all slots filled, either from the user or by default values. Move to final request
    getFinalGuestResponse(showInfo, response);
}

/**
 * Both the one-shot and dialog based paths lead to this method to issue the request, and
 * respond to the user with the final answer.
 */
function getFinalGuestResponse(showInfo, response) {

    // Issue the request, and respond to the user
    makeGuestRequest(showInfo, function guestListResponseCallback(err, guestListResponse) {
        var speechOutput;

        if (err) {
            speechOutput = "Sorry, the API used to collect the guest information i s experiencing a problem. Please try again later";
        } else {
            speechOutput = "Tonight, " + showInfo.host + " welcomes  " + guestListResponse + " to the show.";
        }

        // Need to add code to build the image url for both small and large images ... based on the host requested.  This info will be be supplied to the tellWithCard function.
        var lastName = showInfo.host.split(' ').slice(-1).join(' ');
        var imageFile = {
            smallImageUrl: "https://s3.amazonaws.com/nocturnalninjaimagefiles/" + lastName + "Small.jpg",
            largeImageUrl: "https://s3.amazonaws.com/nocturnalninjaimagefiles/" + lastName + "Large.jpg"
        };
        
        response.tellWithCard(speechOutput, "Nocturnal Ninja", speechOutput, imageFile)
    });
}


// Jimmy Kimmel Live: 1388,
// The Tonight Show Starring Jimmy Fallon: 718,
// The Late Show With Stephen Colbert: 2756


// http://api.tvmaze.com/shows/718/episodesbydate?date=2016-05-05
//response[0].name

function makeGuestRequest(showInfo, guestListResponseCallback) {
    
    /**
Get today's date in format to use with API
*/
    var today = new Date();
        var dd = today.getDate();
        var mm = today.getMonth() + 1; //January is 0!
        var yyyy = today.getFullYear();

        if (dd < 10) {
            dd = '0' + dd;
        } 
        if (mm < 10) {
            mm = '0' + mm;
        } 
        today = yyyy + '-' + mm +'-' + dd;

    var http = require('http');

    //The url we want is: 'www.random.org/integers/?num=1&min=1&max=10&col=1&base=10&format=plain&rnd=new'
    var options = {
        host: 'api.tvmaze.com',
        path: '/shows/' + showInfo.showCode + '/episodesbydate?date=' + today
    };
    http.request(options, function(response) {
        var str = '';

        //another chunk of data has been recieved, so append it to `str`
        response.on('data', function (chunk) {
        str += chunk;
        });

        //the whole response has been recieved, so we just print it out here
        response.on('end', function () {
            var tvMazeResponseObject = JSON.parse(str); 


            if (tvMazeResponseObject.error) {
                console.log("TV Maze error: " + tvMazeResponseObj.error.message);
                guestListResponseCallback(new Error(tvMazeResponseObj.error.message));
            } else {

                // edit the guestList so that it includes 'and' before the last guest name

                var guestList = tvMazeResponseObject[0].name;
                var guestArray = guestList.split(',');

                if (guestArray.length <= 1) {
                    return guestList;
                } else {
                    guestList = guestArray.slice(0, -1) + " and " + guestArray.slice(-1);
                    guestListResponseCallback(null, guestList);
                }
            }
        });
    }).end();
}

/**
 * Gets the show code from the intent, or returns an error
 */
function getShowHostFromIntent(intent, assignDefault) {

    var hostSlot = intent.slots.Host;
    var showSlot = intent.slots.Show;
    // slots can be missing, or slots can be provided but with empty value.
    // must test for both.
    if (!hostSlot.value && !showSlot.value) {
        if (!assignDefault) {
            return {
                error: true
            }
        } else {
            // For sample skill, default to the code for Jimmy Fallon.
            return {
                host: 'jimmy fallon',
                showCode: '718'
            }
        }
    } else {
        // lookup the show code.
        if (hostSlot.value) {
            var showInfo = hostSlot.value;
            var showName = HOSTS[showInfo.toLowerCase()];
        } else if (showSlot.value) {
            showName = showSlot.value;
            console.log('showName: ' + showName);
            showInfo = SHOWS[showName.toLowerCase()];
        }
        
        if (showName) {
            return {
                host: showInfo,
                showCode: SHOWCODE[showName].toString()
            }
        } else {
            return {
                error: true,
                host: showInfo
            }
        }
    }
}

// Create the handler that responds to the Alexa Request.
exports.handler = function (event, context) {
    var nocturnalNinja = new NocturnalNinja();
    nocturnalNinja.execute(event, context);
};

