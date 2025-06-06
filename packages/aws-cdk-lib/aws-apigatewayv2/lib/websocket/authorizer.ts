import { Construct } from 'constructs';
import { IWebSocketApi } from './api';
import { IWebSocketRoute } from './route';
import { CfnAuthorizer } from '.././index';
import { Resource } from '../../../core';
import { ValidationError } from '../../../core/lib/errors';
import { addConstructMetadata } from '../../../core/lib/metadata-resource';
import { propertyInjectable } from '../../../core/lib/prop-injectable';
import { IAuthorizer } from '../common';

/**
 * Supported Authorizer types
 */
export enum WebSocketAuthorizerType {
  /** Lambda Authorizer */
  LAMBDA = 'REQUEST',

  /** IAM Authorizer */
  IAM = 'AWS_IAM',
}

/**
 * Properties to initialize an instance of `WebSocketAuthorizer`.
 */
export interface WebSocketAuthorizerProps {
  /**
   * Name of the authorizer
   * @default - id of the WebSocketAuthorizer construct.
   */
  readonly authorizerName?: string;

  /**
   * WebSocket Api to attach the authorizer to
   */
  readonly webSocketApi: IWebSocketApi;

  /**
   * The type of authorizer
   */
  readonly type: WebSocketAuthorizerType;

  /**
   * The identity source for which authorization is requested.
   * @see https://docs.aws.amazon.com/AWSCloudFormation/latest/UserGuide/aws-resource-apigatewayv2-authorizer.html#cfn-apigatewayv2-authorizer-identitysource
   */
  readonly identitySource: string[];

  /**
   * The authorizer's Uniform Resource Identifier (URI).
   *
   * For REQUEST authorizers, this must be a well-formed Lambda function URI.
   *
   * @default - required for Request authorizer types
   */
  readonly authorizerUri?: string;
}

/**
 * An authorizer for WebSocket APIs
 */
export interface IWebSocketAuthorizer extends IAuthorizer {}

/**
 * Reference to an WebSocket authorizer
 */
export interface WebSocketAuthorizerAttributes {
  /**
   * Id of the Authorizer
   */
  readonly authorizerId: string;

  /**
   * Type of authorizer
   *
   * Possible values are:
   * - CUSTOM - Lambda Authorizer
   * - NONE - No Authorization
   */
  readonly authorizerType: string;
}

/**
 * An authorizer for WebSocket Apis
 * @resource AWS::ApiGatewayV2::Authorizer
 */
@propertyInjectable
export class WebSocketAuthorizer extends Resource implements IWebSocketAuthorizer {
  /**
   * Uniquely identifies this class.
   */
  public static readonly PROPERTY_INJECTION_ID: string = 'aws-cdk-lib.aws-apigatewayv2.WebSocketAuthorizer';

  /**
   * Import an existing WebSocket Authorizer into this CDK app.
   */
  public static fromWebSocketAuthorizerAttributes(scope: Construct, id: string, attrs: WebSocketAuthorizerAttributes): IWebSocketRouteAuthorizer {
    class Import extends Resource implements IWebSocketRouteAuthorizer {
      public readonly authorizerId = attrs.authorizerId;
      public readonly authorizerType = attrs.authorizerType;

      public bind(): WebSocketRouteAuthorizerConfig {
        return {
          authorizerId: attrs.authorizerId,
          authorizationType: attrs.authorizerType,
        };
      }
    }
    return new Import(scope, id);
  }

  public readonly authorizerId: string;

  constructor(scope: Construct, id: string, props: WebSocketAuthorizerProps) {
    super(scope, id);
    // Enhanced CDK Analytics Telemetry
    addConstructMetadata(this, props);

    if (props.type === WebSocketAuthorizerType.LAMBDA && !props.authorizerUri) {
      throw new ValidationError('authorizerUri is mandatory for Lambda authorizers', scope);
    }

    const resource = new CfnAuthorizer(this, 'Resource', {
      name: props.authorizerName ?? id,
      apiId: props.webSocketApi.apiId,
      authorizerType: props.type,
      identitySource: props.identitySource,
      authorizerUri: props.authorizerUri,
    });

    this.authorizerId = resource.ref;
  }
}

/**
 * Input to the bind() operation, that binds an authorizer to a route.
 */
export interface WebSocketRouteAuthorizerBindOptions {
  /**
   * The route to which the authorizer is being bound.
   */
  readonly route: IWebSocketRoute;
  /**
   * The scope for any constructs created as part of the bind.
   */
  readonly scope: Construct;
}

/**
 * Results of binding an authorizer to an WebSocket route.
 */
export interface WebSocketRouteAuthorizerConfig {
  /**
   * The authorizer id
   *
   * @default - No authorizer id (useful for AWS_IAM route authorizer)
   */
  readonly authorizerId?: string;

  /**
   * The type of authorization
   *
   * Possible values are:
   * - CUSTOM - Lambda Authorizer
   * - NONE - No Authorization
   */
  readonly authorizationType: string;
}

/**
 * An authorizer that can attach to an WebSocket Route.
 */
export interface IWebSocketRouteAuthorizer {
  /**
   * Bind this authorizer to a specified WebSocket route.
   */
  bind(options: WebSocketRouteAuthorizerBindOptions): WebSocketRouteAuthorizerConfig;
}

/**
 * Explicitly configure no authorizers on specific WebSocket API routes.
 */
export class WebSocketNoneAuthorizer implements IWebSocketRouteAuthorizer {
  public bind(_options: WebSocketRouteAuthorizerBindOptions): WebSocketRouteAuthorizerConfig {
    return {
      authorizationType: 'NONE',
    };
  }
}
