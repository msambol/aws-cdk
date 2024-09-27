//import { randomUUID } from 'crypto';
import * as msk from '@aws-cdk/aws-msk-alpha';
import { Pipe } from '@aws-cdk/aws-pipes-alpha';
// eslint-disable-next-line import/no-extraneous-dependencies
import { SqsTarget } from '@aws-cdk/aws-pipes-targets-alpha';
import { IntegTest } from '@aws-cdk/integ-tests-alpha';
import * as cdk from 'aws-cdk-lib';
import { MskSource } from '../lib/msk';

const app = new cdk.App();
const stack = new cdk.Stack(app, 'aws-cdk-pipes-sources-msk');
const targetQueue = new cdk.aws_sqs.Queue(stack, 'TargetQueue');

const vpc = new cdk.aws_ec2.Vpc(stack, 'VPC', { maxAzs: 2, restrictDefaultSecurityGroup: false });

const cluster = new msk.Cluster(stack, 'Cluster', {
  clusterName: 'integ-test',
  vpc,
  kafkaVersion: msk.KafkaVersion.V3_6_0,
  removalPolicy: cdk.RemovalPolicy.DESTROY,
  numberOfBrokerNodes: 1,
  // clientAuthentication: msk.ClientAuthentication.sasl({
  //   iam: true,
  // }),
});

const sourceCluster = new MskSource(cluster, {
  topicName: 'nebraska',
});

new Pipe(stack, 'Pipe', {
  source: sourceCluster,
  target: new SqsTarget(targetQueue),
});

new IntegTest(app, 'integtest-pipe-source-msk', {
  testCases: [stack],
});

//const uniqueIdentifier = randomUUID();
// const putMessageOnQueue = test.assertions.awsApiCall('SQS', 'sendMessage', {
//   QueueUrl: sourceQueue.queueUrl,
//   MessageBody: uniqueIdentifier,
// });

// putMessageOnQueue.next(test.assertions.awsApiCall('SQS', 'receiveMessage',
//   {
//     QueueUrl: targetQueue.queueUrl,
//   })).expect(ExpectedResult.objectLike({
//   Messages: [
//     {
//       Body: uniqueIdentifier,
//     },
//   ],
// })).waitForAssertions({
//   totalTimeout: cdk.Duration.seconds(30),
// });

app.synth();
